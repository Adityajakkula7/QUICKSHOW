import React, { useState, useEffect } from 'react'
import Loading from '../components/Loading'
import Blurcircle from '../components/Blurcircle'
import { dateFormat } from '../lib/dateFormat'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react';

const MyBookings = () => {
    const [bookings, setBookings] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user } = useUser();

    const getMyBookings = async () => {
        try {
            const bookingId = searchParams.get('bookingId');
            const success = searchParams.get('success');

            if (success && bookingId) {
                await fetch(`http://localhost:3000/api/bookings/verify/${bookingId}`);
            }

            const res = await fetch(`http://localhost:3000/api/bookings/user/${user?.id || 'guest'}`);
            const data = await res.json();
            if (data.success) {
                setBookings(data.bookings);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
    if (user !== undefined) {
        getMyBookings();
    }
    }, [user]);

    return !isLoading ? (
        <div className='relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]'>
            <Blurcircle top="100px" left="100px" />
            <Blurcircle bottom="0px" left="600px" />
            <h1 className='text-lg font-semibold mb-4'>My Bookings</h1>

            {bookings.length === 0 ? (
                <p className='text-gray-400'>No bookings yet!</p>
            ) : bookings.map((item, index) => (
                <div key={index} className='flex flex-col md:flex-row justify-between
                bg-primary/8 border border-primary/20 rounded-lg mt-4 p-2 max-w-3xl'>
                    <div className='flex flex-col md:flex-row'>
                        <img src={item.moviePoster} alt=""
                            className='md:max-w-45 aspect-video h-auto object-cover object-bottom rounded' />
                        <div className='flex flex-col p-4'>
                            <p className='text-lg font-semibold'>{item.movieTitle}</p>
                            <p className='text-gray-400 text-sm mt-auto'>
                                {dateFormat(item.showDateTime)}
                            </p>
                        </div>
                    </div>
                    <div className='flex flex-col md:items-end md:text-right justify-between p-4'>
                        <div className='flex items-center gap-4'>
                            <p className='text-2xl font-semibold mb-3'>₹{item.amount}</p>
                            {!item.isPaid && (
                                <span className='bg-red-500 px-3 py-1 mb-3 text-xs rounded-full'>
                                    Unpaid
                                </span>
                            )}
                            {item.isPaid && (
                                <span className='bg-green-500 px-3 py-1 mb-3 text-xs rounded-full'>
                                    Paid ✓
                                </span>
                            )}
                        </div>
                        <div className='text-sm'>
                            <p><span className='text-gray-400'>Total Tickets: </span>{item.bookedSeats.length}</p>
                            <p><span className='text-gray-400'>Seats: </span>{item.bookedSeats.join(", ")}</p>
                        </div>
                        {item.isPaid && (
                            <button onClick={() => navigate('/transport')}
                                className='mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600
                                transition rounded-lg text-sm font-medium cursor-pointer'>
                                🚗 Book Cab to Theatre
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <Loading />
    )
}

export default MyBookings