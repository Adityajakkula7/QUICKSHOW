import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'
import { MenuIcon, SearchIcon, TicketPlus, XIcon, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Navbar = () => {

    const [isOpen,setIsOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        setDropdownOpen(false);
        navigate('/');
    };

    return (
        <div className='fixed top-0 left-0 z-50 w-full flex items-center 
            justify-between px-6 md:px-16 lg:px-36 py-5' >
            
            <Link to='/' className='max-md:flex-1'>
                <img src={assets.logo} alt="Logo" className='w-36 h-auto' />
            </Link>

         
            <div className= {`max-md:absolute max-md:top-0 max-md: left-0 max-md:font-medium 
            max-md:text-lg z-50 flex flex-col md:flex-row 
            items-center max-md:justify-center gap-8 min-md:px-8 py-3 max-md:h-screen 
            min-md:rounded-full backdrop-blur bg-black/70 md:bg-white/10 
            md: border border-gray-300/20 overflow-hidden transition-[width] duration-300 
            ${isOpen ? 'max-md:w-full' : 'max-md:w-0'}`}>
            <XIcon className='md:hidden absolute top-6 right-6 w-6 h-6 cursor-pointer' onClick={() => setIsOpen(!isOpen)}/>

                <Link onClick={() => {scrollTo(0,0); setIsOpen(false)}} to='/'>Home</Link>
                <Link onClick={() => {scrollTo(0,0); setIsOpen(false)}} to='/movies'>Movies</Link>
                <Link onClick={() => {scrollTo(0,0); setIsOpen(false)}} to='/'>Theaters</Link>
                <Link onClick={() => {scrollTo(0,0); setIsOpen(false)}} to='/releases'>Releases</Link>
                <Link onClick={() => {scrollTo(0,0); setIsOpen(false)}} to='/favorites'>Favorites</Link>
            </div>

            <div className='flex items-center gap-8'>
                <SearchIcon className='max-md:hidden w-6 h-6 cursor-pointer' />
                  {
                    !user ? (
                            <button onClick={() => navigate('/login')} className='px-4 py-1 sm:px-7 sm:py-2 bg-primary
                             hover:bg-primary-dull transition rounded-full font-medium cursor-pointer'>
                            Login</button>
                    ):(
                        <div className='relative' ref={dropdownRef}>
                            <button 
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className='flex items-center gap-2 cursor-pointer'
                            >
                                <img 
                                    src={user.image} 
                                    alt={user.name} 
                                    className='w-9 h-9 rounded-full object-cover border-2 border-primary/50'
                                />
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div className='absolute right-0 mt-3 w-56 backdrop-blur bg-zinc-900/95 border border-white/10 
                                    rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50'>
                                    {/* User info */}
                                    <div className='px-4 py-3 border-b border-white/10'>
                                        <p className='font-semibold text-sm truncate'>{user.name}</p>
                                        <p className='text-xs text-gray-400 truncate'>{user.email}</p>
                                    </div>
                                    {/* Menu items */}
                                    <div className='py-1'>
                                        <button 
                                            onClick={() => { navigate('/my-bookings'); setDropdownOpen(false); }}
                                            className='flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 
                                                hover:bg-white/5 transition cursor-pointer'
                                        >
                                            <TicketPlus className='w-4 h-4' />
                                            My Bookings
                                        </button>
                                        <button 
                                            onClick={handleLogout}
                                            className='flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 
                                                hover:bg-white/5 transition cursor-pointer'
                                        >
                                            <LogOut className='w-4 h-4' />
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        )

                  }  

                <MenuIcon 
                    className='md:hidden w-8 h-8 cursor-pointer' 
                    onClick={() => setIsOpen(!isOpen)} 
                />
            </div>
        </div>
    )
}

export default Navbar
