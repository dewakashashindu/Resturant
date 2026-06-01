import { createMMKV } from 'react-native-mmkv';

// Create a globally accessible storage instance
export const storage = createMMKV();

export const AUTH_SESSION_KEYS = {
	token: 'user-token',
	isLoggedIn: 'isLoggedIn',
	username: 'auth-username',
	userId: 'auth-user-id',
} as const;