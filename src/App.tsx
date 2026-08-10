import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, isConfigured } from './lib/firebase';
import { useAuthStore, UserProfile } from './store/authStore';
import { AppLayout } from './components/AppLayout';
import { getCurrentUser, setCurrentUser, getUsers } from './lib/storage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { setUser, setProfile, setLoading } = useAuthStore();
  const isFirstSyncRef = useRef(true);

  useEffect(() => {
    // Safety net: ensure loading state resolves even if auth callback hangs
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Sync all local users to Firestore as a migration/backup so the admin can see them!
    const syncLocalUsersToFirestore = async () => {
      try {
        if (db && isConfigured) {
          const localUsers = getUsers();
          for (const u of localUsers) {
            const docRef = doc(db, 'users', u.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              // User already exists in Firestore, do NOT overwrite their approved credits and balances
              await setDoc(docRef, {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                createdAt: u.createdAt || Date.now(),
                password: u.password || ''
              }, { merge: true });
            } else {
              // Safe creation of new users
              await setDoc(docRef, {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                credits: u.credits ?? 100,
                freeCredits: u.freeCredits ?? 0,
                isAdmin: u.isAdmin ?? false,
                createdAt: u.createdAt || Date.now(),
                password: u.password || ''
              }, { merge: true });
            }
          }
        }
      } catch (err) {
        console.warn("Sync local users to Firestore failed:", err);
      }
    };
    syncLocalUsersToFirestore();

    if (!isConfigured) {
      setLoading(false);
      clearTimeout(loadingTimeout);
      return;
    }

    try {
      let unsubProfile: (() => void) | null = null;
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        clearTimeout(loadingTimeout);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        
        if (currentUser) {
          setUser(currentUser);
          const isSeniorAdmin = (currentUser.email || '').toLowerCase() === 'saritagupta77300@gmail.com';
          const docRef = doc(db, 'users', currentUser.uid);
          
          try {
            const emailLower = (currentUser.email || '').trim().toLowerCase();
            let preCreditedCredits = 0;
            let preCreditedFree = 0;
            let foundPreCredited = false;
            let oldDocIdToDelete = '';

            if (emailLower) {
              try {
                const emailDocRef = doc(db, 'users', emailLower);
                const emailDocSnap = await getDoc(emailDocRef);
                if (emailDocSnap.exists()) {
                  const emailData = emailDocSnap.data();
                  preCreditedCredits = Number(emailData?.credits) || 0;
                  preCreditedFree = Number(emailData?.freeCredits) || 0;
                  foundPreCredited = true;
                  oldDocIdToDelete = emailLower;
                  console.log("[PRE-CREDIT] Found pre-credited document by email doc ID:", emailLower, "credits:", preCreditedCredits);
                } else {
                  // fallback query matching email
                  const usersSnap = await getDocs(collection(db, 'users'));
                  const match = usersSnap.docs.find(d => {
                    const dData = d.data();
                    return d.id !== currentUser.uid && (dData?.email || '').trim().toLowerCase() === emailLower;
                  });
                  if (match) {
                    const matchData = match.data();
                    preCreditedCredits = Number(matchData?.credits) || 0;
                    preCreditedFree = Number(matchData?.freeCredits) || 0;
                    foundPreCredited = true;
                    oldDocIdToDelete = match.id;
                    console.log("[PRE-CREDIT] Found pre-credited document by email search:", emailLower, "credits:", preCreditedCredits);
                  }
                }
              } catch (err) {
                console.warn("Pre-credit lookup failed on login:", err);
              }
            }

            let docSnap = null;
            try {
              docSnap = await getDoc(docRef);
            } catch (err) {
              console.warn("getDoc offline or pending:", err);
            }

            if (docSnap && !docSnap.exists()) {
              const localUser = getCurrentUser();
              const existingCredits = (localUser && localUser.uid === currentUser.uid) ? (localUser.credits ?? 0) : 0;
              
              const finalCredits = foundPreCredited ? (preCreditedCredits || existingCredits) : existingCredits;
              const finalFreeCredits = foundPreCredited ? preCreditedFree : 0;

              const newProfile = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                credits: finalCredits,
                freeCredits: finalFreeCredits,
                isAdmin: isSeniorAdmin,
                createdAt: Date.now()
              };
              await setDoc(docRef, newProfile, { merge: true }).catch(() => {});

              if (oldDocIdToDelete && db) {
                await deleteDoc(doc(db, 'users', oldDocIdToDelete)).catch(() => {});
              }
            } else if (docSnap && docSnap.exists()) {
              if (foundPreCredited && preCreditedCredits > 0) {
                const existingData = docSnap.data();
                const updatedCredits = (Number(existingData?.credits) || 0) + preCreditedCredits;
                const updatedFreeCredits = (Number(existingData?.freeCredits) || 0) + preCreditedFree;
                
                await updateDoc(docRef, {
                  credits: updatedCredits,
                  freeCredits: updatedFreeCredits
                }).catch(() => {});

                if (oldDocIdToDelete && db) {
                  await deleteDoc(doc(db, 'users', oldDocIdToDelete)).catch(() => {});
                }
                console.log("[PRE-CREDIT] Merged pre-credited balance to existing user profile! Credits is now:", updatedCredits);
              }

              if (isSeniorAdmin && !docSnap.data()?.isAdmin) {
                await updateDoc(docRef, { isAdmin: true }).catch(() => {});
              }
            }
          } catch (e) {
            console.warn("Auth state doc check error:", e);
          }

          unsubProfile = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              let data = docSnap.data() as UserProfile;
              setProfile(data);
              
              // Sync back to local storage to keep items in sync
              const localUser = getCurrentUser();
              if (localUser && localUser.uid === currentUser.uid) {
                const currentLocalCredits = localUser.credits ?? 0;
                const incomingCredits = data.credits ?? 0;
                let finalCredits = incomingCredits;
                
                if (isFirstSyncRef.current) {
                  isFirstSyncRef.current = false;
                  if (currentLocalCredits > incomingCredits) {
                    finalCredits = currentLocalCredits;
                    if (db) {
                      setDoc(docRef, { credits: currentLocalCredits }, { merge: true }).catch(() => {});
                    }
                  }
                }

                setCurrentUser({ 
                  ...localUser, 
                  ...data,
                  credits: finalCredits
                });
              } else {
                setCurrentUser({
                  uid: currentUser.uid,
                  email: currentUser.email || '',
                  displayName: data.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                  credits: data.credits ?? 0,
                  freeCredits: data.freeCredits ?? 0,
                  isAdmin: isSeniorAdmin,
                  createdAt: data.createdAt || Date.now(),
                  password: data.password || ''
                });
              }
            } else {
              // The user exists in Firebase Auth but not in Firestore! Auto-create document.
              const emailLower = (currentUser.email || '').trim().toLowerCase();
              let preCreditedCredits = 0;
              let preCreditedFree = 0;
              let foundPreCredited = false;
              let oldDocIdToDelete = '';

              const getAndMergePrecredited = async () => {
                if (emailLower) {
                  try {
                    const emailDocRef = doc(db, 'users', emailLower);
                    const emailDocSnap = await getDoc(emailDocRef);
                    if (emailDocSnap.exists()) {
                      const emailData = emailDocSnap.data();
                      preCreditedCredits = Number(emailData?.credits) || 0;
                      preCreditedFree = Number(emailData?.freeCredits) || 0;
                      foundPreCredited = true;
                      oldDocIdToDelete = emailLower;
                    } else {
                      const usersSnap = await getDocs(collection(db, 'users'));
                      const match = usersSnap.docs.find(d => {
                        const dData = d.data();
                        return d.id !== currentUser.uid && (dData?.email || '').trim().toLowerCase() === emailLower;
                      });
                      if (match) {
                        const matchData = match.data();
                        preCreditedCredits = Number(matchData?.credits) || 0;
                        preCreditedFree = Number(matchData?.freeCredits) || 0;
                        foundPreCredited = true;
                        oldDocIdToDelete = match.id;
                      }
                    }
                  } catch (err) {
                    console.warn("Pre-credit lookup failed inside snapshot:", err);
                  }
                }

                const localUser = getCurrentUser();
                const existingCredits = (localUser && localUser.uid === currentUser.uid) ? (localUser.credits ?? 0) : 0;
                
                const finalCredits = foundPreCredited ? (preCreditedCredits || existingCredits) : existingCredits;
                const finalFreeCredits = foundPreCredited ? preCreditedFree : 0;

                const newProfile = {
                  uid: currentUser.uid,
                  email: currentUser.email || '',
                  displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                  credits: finalCredits,
                  freeCredits: finalFreeCredits,
                  isAdmin: isSeniorAdmin,
                  createdAt: Date.now()
                };

                await setDoc(docRef, newProfile, { merge: true }).catch((err) => {
                  console.warn("Auto-creating user document failed inside snapshot:", err);
                });

                if (oldDocIdToDelete && db) {
                  await deleteDoc(doc(db, 'users', oldDocIdToDelete)).catch(() => {});
                }
              };
              getAndMergePrecredited();
            }
            setLoading(false);
          }, (error) => {
            console.warn("Profile snapshot error:", error);
            setLoading(false);
          });
        } else {
          // Check if there is a local storage user logged in!
          const localUser = getCurrentUser();
          if (localUser) {
            setUser(localUser as any);
            const docRef = doc(db, 'users', localUser.uid);
            unsubProfile = onSnapshot(docRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile(data);
                // Sync to local storage to keep items in sync
                const currentLocalCredits = localUser.credits ?? 0;
                const incomingCredits = data.credits ?? 0;
                let finalCredits = incomingCredits;

                if (isFirstSyncRef.current) {
                  isFirstSyncRef.current = false;
                  if (currentLocalCredits > incomingCredits) {
                    finalCredits = currentLocalCredits;
                    if (db) {
                      setDoc(docRef, { credits: currentLocalCredits }, { merge: true }).catch(() => {});
                    }
                  }
                }

                setCurrentUser({ 
                  ...localUser, 
                  ...data,
                  credits: finalCredits
                });
              } else {
                setProfile(localUser);
                // Upload this missing local user to Firestore immediately so they sync with the admin dashboard
                setDoc(docRef, {
                  uid: localUser.uid,
                  email: localUser.email,
                  displayName: localUser.displayName,
                  credits: localUser.credits ?? 0,
                  freeCredits: localUser.freeCredits ?? 0,
                  isAdmin: localUser.isAdmin ?? false,
                  createdAt: localUser.createdAt || Date.now(),
                  password: localUser.password || ''
                }, { merge: true }).catch(err => {
                  console.warn("Auto-sync local profile to Firestore failed:", err);
                });
              }
              setLoading(false);
            }, (error) => {
              console.warn("Local user Firestore snapshot error:", error);
              setProfile(localUser);
              setLoading(false);
            });
          } else {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        }
      }, (error) => {
        console.warn("Auth state error:", error);
        clearTimeout(loadingTimeout);
        setUser(null);
        setProfile(null);
        setLoading(false);
      });

      return () => {
        clearTimeout(loadingTimeout);
        unsubscribe();
        if (unsubProfile) unsubProfile();
      };
    } catch (error) {
      console.warn("Firebase init error:", error);
      clearTimeout(loadingTimeout);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, [setUser, setProfile, setLoading]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout />
    </BrowserRouter>
  );
}

