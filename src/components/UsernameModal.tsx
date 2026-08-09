import { useState, FormEvent } from 'react';
import { useAuthStore } from '../store/authStore';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateUser, isUsernameTaken } from '../lib/storage';
import { motion } from 'motion/react';
import { UserCheck } from 'lucide-react';

export function UsernameModal() {
  return null;
}
