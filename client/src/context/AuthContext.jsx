import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [isLoaded, setIsLoaded] = useState(false);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    // Restore session on mount
    useEffect(() => {
        const restoreSession = async () => {
            const storedToken = localStorage.getItem('token');
            if (!storedToken) {
                setIsLoaded(true);
                return;
            }

            try {
                const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
                    headers: { 'Authorization': `Bearer ${storedToken}` }
                });
                const data = await res.json();
                if (data.success) {
                    setUser(data.user);
                    setToken(storedToken);
                } else {
                    // Token is invalid/expired — clear it
                    localStorage.removeItem('token');
                    setToken(null);
                }
            } catch (error) {
                console.error('Session restore failed:', error);
                localStorage.removeItem('token');
                setToken(null);
            } finally {
                setIsLoaded(true);
            }
        };

        restoreSession();
    }, []);

    const login = async (email, password) => {
        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('token', data.token);
        }
        return data;
    };

    const register = async (name, email, password) => {
        const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (data.success) {
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('token', data.token);
        }
        return data;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoaded, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
