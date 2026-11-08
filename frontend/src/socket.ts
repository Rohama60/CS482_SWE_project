import { io } from 'socket.io-client';
import { getGuest } from './guestSession';

export const socket = io('http://localhost:3000', {
    withCredentials: true,
    autoConnect: false,
    auth: (callback) => {
        callback({
            guestId: getGuest()?.id ?? null
        });
    }
});