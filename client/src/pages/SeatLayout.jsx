import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Loading from '../components/Loading';
import { ArrowRightIcon, ClockIcon } from 'lucide-react';
import isoTimeFormat from '../lib/isoTimeFormat';
import Blurcircle from '../components/Blurcircle';
import toast from 'react-hot-toast';
import { assets } from '../assets/assets';
import { useUser } from '@clerk/clerk-react';

const SeatLayout = () => {

    const groupRows = [["A",'B'],['C','D'],['E','F'],['G','H'],['I','J']];

    const {id, date} = useParams()
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [show, setShow] = useState(null);
    const navigate = useNavigate()
    const { user } = useUser();

   const generateDateTimes = () => {
    const dateTime = {};
    for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() + day);
        const dateKey = date.toISOString().split('T')[0];
        
        dateTime[dateKey] = [
            { time: `${dateKey}T05:45:00.000Z`, showId: `${dateKey}-1` }, // 11:15 AM IST
            { time: `${dateKey}T09:00:00.000Z`, showId: `${dateKey}-2` }, // 2:30 PM IST
            { time: `${dateKey}T12:30:00.000Z`, showId: `${dateKey}-3` }, // 6:00 PM IST
            { time: `${dateKey}T15:30:00.000Z`, showId: `${dateKey}-4` }, // 9:00 PM IST
        ];
    }
    return dateTime;
    };

const getShow = async () => {
    try {
        const res = await fetch(`http://localhost:3000/api/movies/${id}`);
        const data = await res.json();
        if (data.success) {
            setShow({
                movie: data.movie,
                dateTime: generateDateTimes()
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

    const handleSeatClick = (seatId) => {
        if (!selectedTime) {
            return toast("Please select time first")
        }
        if (!selectedSeats.includes(seatId) && selectedSeats.length >= 5) {
            return toast("You can only select 5 seats")
        }
        setSelectedSeats(prev => prev.includes(seatId)
            ? prev.filter(seat => seat !== seatId)
            : [...prev, seatId])
    }

    const renderSeats = (row, count = 9) => (
        <div key={row} className="flex gap-2 mt-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: count }, (_, i) => {
                    const seatId = `${row}${i + 1}`;
                    return (
                        <button key={seatId} onClick={() => handleSeatClick(seatId)}
                            className={`h-8 w-8 rounded border border-primary/60 
                            cursor-pointer text-xs ${selectedSeats.includes(seatId)
                                ? "bg-primary text-white"
                                : "hover:bg-primary/20"}`}>
                            {seatId}
                        </button>
                    );
                })}
            </div>
        </div>
    )

    useEffect(() => {
        getShow()
    }, [])


   const handleCheckout = async () => {
    if (!selectedTime) return toast('Please select a time first');
    if (selectedSeats.length === 0) return toast('Please select at least one seat');

    console.log('Sending:', {
        seats: selectedSeats,
        movieId: show.movie.id,
        movieTitle: show.movie.title,
        moviePoster: show.movie.poster_path,
        showTime: selectedTime.time,
        amount: selectedSeats.length * 150,
        userId: 'guest'
    });

    try {
        const res = await fetch('http://localhost:3000/api/bookings/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seats: selectedSeats,
                movieId: show.movie.id,
                movieTitle: show.movie.title,
                moviePoster: show.movie.poster_path,
                showTime: selectedTime.time,
                amount: selectedSeats.length * 150,
                userId: user?.id || 'guest'
            })
        });

        const data = await res.json();
        console.log('Response:', data);
        
        if (data.success) {
            window.location.href = data.url;
        } else {
            toast('Payment failed. Try again!');
        }
    } catch (error) {
        console.error(error);
        toast('Something went wrong!');
    }
};


    const timings = show?.dateTime?.[date] || [];

    return show ? (
        <div className='flex flex-col md:flex-row px-6 md:px-16 lg:px-40 py-30 md:pt-50'>

            {/* Available Timings */}
            <div className='w-60 bg-primary/10 border border-primary/20 rounded-lg py-10 h-max md:sticky md:top-30'>
                <p className='text-lg font-semibold px-6'>Available Timings</p>
                <div className='mt-5 space-y-1'>
                    {timings.length > 0 ? timings.map((item) => (
                        <div key={item.time} onClick={() => setSelectedTime(item)}
                            className={`flex items-center gap-2 px-6 py-2 w-max rounded-r-md
                            cursor-pointer transition ${selectedTime?.time === item.time
                                ? 'bg-primary text-white'
                                : 'hover:bg-primary/20'}`}>
                            <ClockIcon className="w-4 h-4" />
                            <p className='text-sm'>{isoTimeFormat(item.time)}</p>
                        </div>
                    )) : (
                        <p className='px-6 text-sm text-gray-400'>No shows available</p>
                    )}
                </div>
            </div>

            {/* Seats Layout */}
            <div className='relative flex-1 flex flex-col items-center max-md:mt-16'>
                <Blurcircle top="-100px" left="-100px" />
                <Blurcircle bottom="0" right="0" />
                <h1 className='text-2xl font-semibold mb-4'>Select your seat</h1>
                <img src={assets.screenImage} alt="screen" />
                <p className='text-gray-400 text-sm mb-6'>SCREEN SIDE</p>

                <div className='flex flex-col items-center mt-10 text-xs text-gray-300'>
                    <div className='grid grid-cols-2 md:grid-cols-1 gap-8 md:gap-2 mb-6'>
                        {groupRows[0].map(row => renderSeats(row))}
                    </div>
                    <div className='grid grid-cols-2 gap-11'>
                        {groupRows.slice(1).map((group, idx) => (
                            <div key={idx}>
                                {group.map(row => renderSeats(row))}
                            </div>
                        ))}
                    </div>
                </div>
                
                
                <button onClick={handleCheckout}
                    className='flex items-center gap-1 mt-20 px-10 py-3 text-sm bg-primary
                    hover:bg-primary-dull transition rounded-full font-medium cursor-pointer active:scale-95'>
                    Proceed to Checkout
                    <ArrowRightIcon strokeWidth={3} className='w-4 h-4' />
                </button>
            </div>
        </div>
    ) : (
        <Loading />
    )
}

export default SeatLayout