import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Blurcircle from '../components/Blurcircle';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            return toast.error('Please fill in all fields');
        }
        setIsSubmitting(true);
        try {
            const data = await login(email, password);
            if (data.success) {
                toast.success('Welcome back!');
                navigate('/');
            } else {
                toast.error(data.message || 'Login failed');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='relative flex items-center justify-center min-h-screen px-6'>
            <Blurcircle top="-50px" left="-100px" />
            <Blurcircle bottom="50px" right="-50px" />

            <div className='relative w-full max-w-md'>
                {/* Card */}
                <div className='backdrop-blur bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl'>
                    {/* Header */}
                    <div className='text-center mb-8'>
                        <div className='inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 mb-4'>
                            <LogIn className='w-7 h-7 text-primary' />
                        </div>
                        <h1 className='text-2xl font-bold'>Welcome Back</h1>
                        <p className='text-gray-400 text-sm mt-1'>Sign in to your QuickShow account</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className='space-y-5'>
                        <div>
                            <label className='block text-sm text-gray-300 mb-1.5'>Email</label>
                            <input
                                type='email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder='you@example.com'
                                className='w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10
                                    text-white placeholder-gray-500 outline-none focus:border-primary/50
                                    focus:ring-1 focus:ring-primary/30 transition'
                            />
                        </div>

                        <div>
                            <label className='block text-sm text-gray-300 mb-1.5'>Password</label>
                            <div className='relative'>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder='••••••••'
                                    className='w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10
                                        text-white placeholder-gray-500 outline-none focus:border-primary/50
                                        focus:ring-1 focus:ring-primary/30 transition pr-12'
                                />
                                <button
                                    type='button'
                                    onClick={() => setShowPassword(!showPassword)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                                        hover:text-white transition cursor-pointer'
                                >
                                    {showPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
                                </button>
                            </div>
                        </div>

                        <button
                            type='submit'
                            disabled={isSubmitting}
                            className='w-full py-3 bg-primary hover:bg-primary-dull transition rounded-lg
                                font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                                active:scale-[0.98]'
                        >
                            {isSubmitting ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className='text-center text-sm text-gray-400 mt-6'>
                        Don't have an account?{' '}
                        <Link to='/register' className='text-primary hover:underline font-medium'>
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
