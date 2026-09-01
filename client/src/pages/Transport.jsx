import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import toast from 'react-hot-toast'

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41],
});

const theatreIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41],
});

const MapUpdater = ({ center }) => {
    const map = useMap();
    useEffect(() => { map.setView(center, 13); }, [center]);
    return null;
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const Transport = () => {
    const [userLocation, setUserLocation] = useState(null);
    const [manualAddress, setManualAddress] = useState('');
    const [useManualAddress, setUseManualAddress] = useState(false);

    const [theatres, setTheatres] = useState([]);
    const [selectedTheatre, setSelectedTheatre] = useState(null);

    const [routeData, setRouteData] = useState(null); // { distanceKm, durationText, fares, isDevelopmentFallback, devNote }
    const [routePolyline, setRoutePolyline] = useState(null); // for the map line
    const [cabType, setCabType] = useState('mini');
    const [booking, setBooking] = useState(null);

    const [loadingLocation, setLoadingLocation] = useState(true);
    const [loadingRoute, setLoadingRoute] = useState(false);

    // ── Get user location ─────────────────────────────────────────────────────
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                setLoadingLocation(false);
            },
            () => {
                // Default to Hyderabad if location denied
                setUserLocation([17.3850, 78.4867]);
                setLoadingLocation(false);
            }
        );
    }, []);

    // ── Fetch theatres from backend ────────────────────────────────────────────
    useEffect(() => {
        const fetchTheatres = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/transport/theatres`);
                const data = await res.json();
                if (data.success) setTheatres(data.theatres);
            } catch (err) {
                console.error('Failed to fetch theatres:', err);
                toast.error('Could not load theatre list');
            }
        };
        fetchTheatres();
    }, []);

    // ── Calculate route via backend proxy ─────────────────────────────────────
    // The Google Maps API key stays on the server — never exposed here.
    const getRoute = async (theatre) => {
        setSelectedTheatre(theatre);
        setBooking(null);
        setLoadingRoute(true);

        try {
            // Build origin: coordinates if available and not using manual address
            let origin;
            if (useManualAddress && manualAddress.trim().length >= 3) {
                origin = manualAddress.trim();
            } else if (userLocation) {
                origin = { lat: userLocation[0], lng: userLocation[1] };
            } else {
                toast.error('Please allow location access or enter your address');
                setLoadingRoute(false);
                return;
            }

            const res = await fetch(`${BACKEND_URL}/api/transport/route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, theatreId: theatre.id }),
            });

            const data = await res.json();

            if (!data.success) {
                toast.error(data.message || 'Could not calculate route');
                setLoadingRoute(false);
                return;
            }

            setRouteData(data);

            // Draw a straight line on the map (visual guide only — not the actual road)
            // Real turn-by-turn geometry is not needed; Google provides the distance/duration
            if (userLocation) {
                setRoutePolyline([
                    userLocation,
                    [theatre.lat, theatre.lng],
                ]);
            }
        } catch (err) {
            console.error('Route error:', err);
            toast.error('Failed to calculate route. Please try again.');
        } finally {
            setLoadingRoute(false);
        }
    };

    // ── Simulated cab booking (UX demo) ───────────────────────────────────────
    const handleBookCab = () => {
        if (!selectedTheatre || !routeData) return;
        const fareInfo = routeData.fares?.[cabType];
        if (!fareInfo) return;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const driverName = ['Ravi Kumar', 'Suresh Babu', 'Anil Singh', 'Ramesh Yadav'][Math.floor(Math.random() * 4)];
        const driverPhone = `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`;
        const eta = Math.ceil(routeData.distanceKm / 30 * 60);

        setBooking({
            otp,
            driverName,
            driverPhone,
            eta,
            fare: fareInfo.estimatedFare,
            fareBreakdown: fareInfo.breakdown,
            cabType: fareInfo.name,
            theatre: selectedTheatre.name,
            disclaimer: routeData.fareDisclaimer,
        });

        toast.success('Cab booking initiated! 🚗');
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loadingLocation) return (
        <div className='flex items-center justify-center min-h-screen'>
            <p className='text-gray-400'>Getting your location...</p>
        </div>
    );

    // ── Booking confirmation screen ────────────────────────────────────────────
    if (booking) return (
        <div className='px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-screen flex items-center justify-center'>
            <div className='bg-primary/10 border border-primary/20 rounded-2xl p-8 max-w-md w-full text-center'>
                <div className='text-6xl mb-4'>🚗</div>
                <h1 className='text-2xl font-bold text-green-400 mb-2'>Cab Booking Initiated!</h1>
                <p className='text-gray-400 text-sm mb-6'>Your ride request has been placed</p>

                <div className='bg-gray-800 rounded-xl p-4 mb-4'>
                    <p className='text-gray-400 text-xs mb-1'>Your OTP</p>
                    <p className='text-4xl font-bold text-primary tracking-widest'>{booking.otp}</p>
                    <p className='text-gray-400 text-xs mt-1'>Share this with your driver</p>
                </div>

                <div className='text-left space-y-3 mb-6'>
                    {[
                        ['Driver', booking.driverName],
                        ['Phone', booking.driverPhone],
                        ['ETA', `${booking.eta} mins`],
                        ['Cab Type', booking.cabType],
                        ['Destination', booking.theatre],
                    ].map(([label, value]) => (
                        <div key={label} className='flex justify-between'>
                            <span className='text-gray-400 text-sm'>{label}</span>
                            <span className='text-sm font-medium'>{value}</span>
                        </div>
                    ))}
                    <div className='flex justify-between border-t border-gray-700 pt-3'>
                        <span className='text-gray-400 text-sm'>Estimated Fare</span>
                        <span className='text-lg font-bold text-primary'>₹{booking.fare}</span>
                    </div>
                </div>

                {/* Fare disclaimer — clearly labeled as estimate */}
                <p className='text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3 mb-4 text-left'>
                    ⚠️ {booking.disclaimer}
                </p>

                <button onClick={() => setBooking(null)}
                    className='w-full py-3 bg-primary hover:bg-primary-dull transition rounded-lg text-sm font-medium cursor-pointer'>
                    Back to Map
                </button>
            </div>
        </div>
    );

    const currentFare = routeData?.fares?.[cabType];

    return (
        <div className='px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-screen'>
            <h1 className='text-2xl font-semibold mb-2'>Book a Ride to Theatre 🚗</h1>
            <p className='text-gray-400 text-sm mb-6'>Select a theatre and get a route estimate powered by Google Maps</p>

            {/* Dev fallback banner */}
            {routeData?.isDevelopmentFallback && (
                <div className='mb-4 p-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg text-yellow-300 text-sm'>
                    🛠️ <strong>Dev Mode:</strong> {routeData.devNote}
                </div>
            )}

            {/* Pickup location options */}
            <div className='mb-4 p-4 bg-primary/10 border border-primary/20 rounded-xl'>
                <p className='font-semibold text-sm mb-3'>📍 Your Pickup Location</p>
                <div className='flex gap-2 mb-3'>
                    <button
                        onClick={() => setUseManualAddress(false)}
                        className={`px-4 py-2 text-xs rounded-lg transition cursor-pointer
                            ${!useManualAddress ? 'bg-primary text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        Use My Location
                    </button>
                    <button
                        onClick={() => setUseManualAddress(true)}
                        className={`px-4 py-2 text-xs rounded-lg transition cursor-pointer
                            ${useManualAddress ? 'bg-primary text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        Enter Address
                    </button>
                </div>
                {useManualAddress && (
                    <input
                        type='text'
                        value={manualAddress}
                        onChange={e => setManualAddress(e.target.value)}
                        placeholder='e.g. Hitech City, Hyderabad'
                        className='w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm
                            placeholder-gray-500 focus:outline-none focus:border-primary'
                    />
                )}
                {!useManualAddress && userLocation && (
                    <p className='text-xs text-gray-400'>📌 Using GPS: {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}</p>
                )}
            </div>

            <div className='flex flex-col lg:flex-row gap-6'>
                {/* Map */}
                <div className='flex-1 rounded-xl overflow-hidden h-96 lg:h-[500px]'>
                    {userLocation && (
                        <MapContainer center={userLocation} zoom={13}
                            style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='© OpenStreetMap contributors'
                            />
                            <MapUpdater center={selectedTheatre ? [selectedTheatre.lat, selectedTheatre.lng] : userLocation} />
                            <Marker position={userLocation} icon={userIcon}>
                                <Popup>📍 Your Location</Popup>
                            </Marker>
                            {theatres.map((theatre) => (
                                <Marker key={theatre.id}
                                    position={[theatre.lat, theatre.lng]}
                                    icon={theatreIcon}
                                    eventHandlers={{ click: () => getRoute(theatre) }}>
                                    <Popup>🎬 {theatre.name}</Popup>
                                </Marker>
                            ))}
                            {routePolyline && (
                                <Polyline positions={routePolyline} color="#e11d48" weight={3} dashArray="8,8" />
                            )}
                        </MapContainer>
                    )}
                </div>

                {/* Sidebar */}
                <div className='lg:w-80 flex flex-col gap-4'>
                    {/* Theatre list */}
                    <div className='bg-primary/10 border border-primary/20 rounded-xl p-4'>
                        <p className='font-semibold mb-3'>🎭 Select a Theatre</p>
                        {theatres.length === 0 ? (
                            <p className='text-gray-400 text-sm'>Loading theatres...</p>
                        ) : theatres.map((theatre) => (
                            <div key={theatre.id} onClick={() => getRoute(theatre)}
                                className={`p-3 rounded-lg cursor-pointer mb-2 transition
                                ${selectedTheatre?.id === theatre.id
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-800 hover:bg-gray-700'}`}>
                                <p className='text-sm font-medium'>{theatre.name}</p>
                                <p className='text-xs text-gray-400 truncate'>{theatre.address}</p>
                            </div>
                        ))}
                    </div>

                    {/* Route info + fare estimate */}
                    {selectedTheatre && (
                        <div className='bg-primary/10 border border-primary/20 rounded-xl p-4'>
                            {loadingRoute ? (
                                <p className='text-gray-400 text-sm text-center py-4'>Calculating route...</p>
                            ) : routeData ? (
                                <>
                                    <p className='font-semibold mb-3'>🗺️ Route Details</p>
                                    <div className='flex gap-4 mb-4 text-sm'>
                                        <div className='bg-gray-800 rounded-lg px-3 py-2 flex-1 text-center'>
                                            <p className='text-gray-400 text-xs'>Distance</p>
                                            <p className='font-bold text-white'>{routeData.distanceText}</p>
                                        </div>
                                        <div className='bg-gray-800 rounded-lg px-3 py-2 flex-1 text-center'>
                                            <p className='text-gray-400 text-xs'>Duration</p>
                                            <p className='font-bold text-white'>{routeData.durationText}</p>
                                        </div>
                                    </div>

                                    <p className='font-semibold mb-3'>💰 Estimated Fare</p>
                                    <div className='flex gap-2 mb-3'>
                                        {['auto', 'mini', 'sedan'].map(type => (
                                            <button key={type} onClick={() => setCabType(type)}
                                                className={`flex-1 py-2 text-xs rounded-lg transition cursor-pointer
                                                ${cabType === type ? 'bg-primary text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                                {routeData.fares?.[type]?.name}
                                            </button>
                                        ))}
                                    </div>

                                    {currentFare && (
                                        <>
                                            <div className='flex items-end justify-between mb-1'>
                                                <div>
                                                    <p className='text-gray-400 text-xs'>ESTIMATED FARE</p>
                                                    <p className='text-2xl font-bold text-primary'>₹{currentFare.estimatedFare}</p>
                                                </div>
                                                <p className='text-xs text-gray-500'>{currentFare.breakdown}</p>
                                            </div>

                                            {/* Fare disclaimer — always visible */}
                                            <p className='text-xs text-amber-400 mb-3 bg-amber-400/10 border border-amber-400/20 rounded-lg p-2'>
                                                ⚠️ Estimate only — actual fare may vary
                                            </p>

                                            <button onClick={handleBookCab}
                                                className='w-full py-3 bg-primary hover:bg-primary-dull transition rounded-lg text-sm font-medium cursor-pointer'>
                                                Book {currentFare.name} 🚗
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <p className='text-gray-400 text-sm text-center py-4'>
                                    Click a theatre to calculate route
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Transport;