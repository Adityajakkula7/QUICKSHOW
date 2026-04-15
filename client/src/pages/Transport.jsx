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
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const theatreIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const MapUpdater = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 13);
    }, [center]);
    return null;
};

const Transport = () => {
    const [userLocation, setUserLocation] = useState(null);
    const [theatres, setTheatres] = useState([]);
    const [selectedTheatre, setSelectedTheatre] = useState(null);
    const [route, setRoute] = useState(null);
    const [fare, setFare] = useState(null);
    const [distance, setDistance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cabType, setCabType] = useState('mini');
    const [booking, setBooking] = useState(null); // booking confirmation

    const cabFares = {
        auto: { base: 25, perKm: 12, name: 'Auto' },
        mini: { base: 40, perKm: 14, name: 'Mini Cab' },
        sedan: { base: 50, perKm: 18, name: 'Sedan' },
    };

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                setLoading(false);
            },
            () => {
                setUserLocation([17.3850, 78.4867]);
                setLoading(false);
            }
        );
    }, []);

    // Fetch theatres within 20km radius
    useEffect(() => {
        if (!userLocation) return;
        const fetchTheatres = async () => {
            try {
                const [lat, lon] = userLocation;

                // 20km in degrees ≈ 0.18
                const delta = 0.18;
                const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;

                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=cinema&format=json&limit=10&countrycodes=in&viewbox=${viewbox}&bounded=1`
                );
                const data = await res.json();

                // Filter to strictly 20km radius
                const nearby = data.filter(t => {
                    const R = 6371;
                    const dLat = (parseFloat(t.lat) - lat) * Math.PI / 180;
                    const dLon = (parseFloat(t.lon) - lon) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(lat * Math.PI / 180) * Math.cos(parseFloat(t.lat) * Math.PI / 180) *
                        Math.sin(dLon/2) * Math.sin(dLon/2);
                    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return distKm <= 20;
                });

                setTheatres(nearby.map(t => ({
                    name: t.display_name.split(',')[0],
                    lat: parseFloat(t.lat),
                    lon: parseFloat(t.lon),
                    address: t.display_name
                })));
            } catch (error) {
                console.error('Error fetching theatres:', error);
            }
        };
        fetchTheatres();
    }, [userLocation]);

    const getRoute = async (theatre) => {
        setSelectedTheatre(theatre);
        setBooking(null); // reset booking when new theatre selected
        try {
            const [userLat, userLon] = userLocation;
            const res = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${userLon},${userLat};${theatre.lon},${theatre.lat}?overview=full&geometries=geojson`
            );
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(
                    ([lon, lat]) => [lat, lon]
                );
                setRoute(coords);
                const distKm = (data.routes[0].distance / 1000).toFixed(1);
                setDistance(distKm);
                calculateFare(distKm);
            }
        } catch (error) {
            console.error('Route error:', error);
        }
    };

    const calculateFare = (distKm) => {
        const cab = cabFares[cabType];
        const estimatedFare = Math.round(cab.base + (distKm * cab.perKm));
        setFare(estimatedFare);
    };

    useEffect(() => {
        if (distance) calculateFare(distance);
    }, [cabType, distance]);

    // Generate random OTP
    const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

    const handleBookCab = () => {
        if (!selectedTheatre || !fare) return;
        const otp = generateOTP();
        const driverName = ['Ravi Kumar', 'Suresh Babu', 'Anil Singh', 'Ramesh Yadav'][Math.floor(Math.random() * 4)];
        const driverPhone = `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`;
        const eta = Math.ceil(distance / 30 * 60); // rough ETA in minutes

        setBooking({
            otp,
            driverName,
            driverPhone,
            eta,
            fare,
            cabType: cabFares[cabType].name,
            theatre: selectedTheatre.name
        });

        toast.success('Cab booked successfully! 🚗');
    };

    if (loading) return (
        <div className='flex items-center justify-center min-h-screen'>
            <p className='text-gray-400'>Getting your location...</p>
        </div>
    );

    // Booking confirmation screen
    if (booking) return (
        <div className='px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-screen flex items-center justify-center'>
            <div className='bg-primary/10 border border-primary/20 rounded-2xl p-8 max-w-md w-full text-center'>
                <div className='text-6xl mb-4'>🚗</div>
                <h1 className='text-2xl font-bold text-green-400 mb-2'>Cab Booked Successfully!</h1>
                <p className='text-gray-400 text-sm mb-6'>Your ride is on the way</p>

                <div className='bg-gray-800 rounded-xl p-4 mb-4'>
                    <p className='text-gray-400 text-xs mb-1'>Your OTP</p>
                    <p className='text-4xl font-bold text-primary tracking-widest'>{booking.otp}</p>
                    <p className='text-gray-400 text-xs mt-1'>Share this with your driver</p>
                </div>

                <div className='text-left space-y-3 mb-6'>
                    <div className='flex justify-between'>
                        <span className='text-gray-400 text-sm'>Driver</span>
                        <span className='text-sm font-medium'>{booking.driverName}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-gray-400 text-sm'>Phone</span>
                        <span className='text-sm font-medium'>{booking.driverPhone}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-gray-400 text-sm'>ETA</span>
                        <span className='text-sm font-medium'>{booking.eta} mins</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-gray-400 text-sm'>Cab Type</span>
                        <span className='text-sm font-medium'>{booking.cabType}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-gray-400 text-sm'>Destination</span>
                        <span className='text-sm font-medium'>{booking.theatre}</span>
                    </div>
                    <div className='flex justify-between border-t border-gray-700 pt-3'>
                        <span className='text-gray-400 text-sm'>Total Fare</span>
                        <span className='text-lg font-bold text-primary'>₹{booking.fare}</span>
                    </div>
                </div>

                <button onClick={() => setBooking(null)}
                    className='w-full py-3 bg-primary hover:bg-primary-dull transition
                    rounded-lg text-sm font-medium cursor-pointer'>
                    Back to Map
                </button>
            </div>
        </div>
    );

    return (
        <div className='px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-screen'>
            <h1 className='text-2xl font-semibold mb-2'>Book a Ride to Theatre 🚗</h1>
            <p className='text-gray-400 text-sm mb-6'>Find theatres near you and book a cab</p>

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
                            <MapUpdater center={userLocation} />
                            <Marker position={userLocation} icon={userIcon}>
                                <Popup>📍 Your Location</Popup>
                            </Marker>
                            {theatres.map((theatre, idx) => (
                                <Marker key={idx}
                                    position={[theatre.lat, theatre.lon]}
                                    icon={theatreIcon}
                                    eventHandlers={{ click: () => getRoute(theatre) }}>
                                    <Popup>🎬 {theatre.name}</Popup>
                                </Marker>
                            ))}
                            {route && <Polyline positions={route} color="#e11d48" weight={4} />}
                        </MapContainer>
                    )}
                </div>

                {/* Sidebar */}
                <div className='lg:w-80 flex flex-col gap-4'>
                    {/* Nearby Theatres */}
                    <div className='bg-primary/10 border border-primary/20 rounded-xl p-4'>
                        <p className='font-semibold mb-3'>🎭 Nearby Theatres <span className='text-xs text-gray-400'>(within 20km)</span></p>
                        {theatres.length === 0 ? (
                            <p className='text-gray-400 text-sm'>No theatres found within 20km</p>
                        ) : theatres.map((theatre, idx) => (
                            <div key={idx} onClick={() => getRoute(theatre)}
                                className={`p-3 rounded-lg cursor-pointer mb-2 transition
                                ${selectedTheatre?.name === theatre.name
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-800 hover:bg-gray-700'}`}>
                                <p className='text-sm font-medium'>{theatre.name}</p>
                                <p className='text-xs text-gray-400 truncate'>{theatre.address}</p>
                            </div>
                        ))}
                    </div>

                    {/* Fare Estimate */}
                    {selectedTheatre && distance && (
                        <div className='bg-primary/10 border border-primary/20 rounded-xl p-4'>
                            <p className='font-semibold mb-3'>💰 Fare Estimate</p>
                            <p className='text-sm text-gray-400 mb-3'>
                                Distance: <span className='text-white'>{distance} km</span>
                            </p>
                            <div className='flex gap-2 mb-4'>
                                {Object.entries(cabFares).map(([key, val]) => (
                                    <button key={key} onClick={() => setCabType(key)}
                                        className={`flex-1 py-2 text-xs rounded-lg transition cursor-pointer
                                        ${cabType === key
                                            ? 'bg-primary text-white'
                                            : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        {val.name}
                                    </button>
                                ))}
                            </div>
                            <div className='flex items-center justify-between mb-4'>
                                <p className='text-gray-400 text-sm'>Estimated Fare:</p>
                                <p className='text-2xl font-bold text-primary'>₹{fare}</p>
                            </div>
                            <button onClick={handleBookCab}
                                className='w-full py-3 bg-primary hover:bg-primary-dull
                                transition rounded-lg text-sm font-medium cursor-pointer'>
                                Book {cabFares[cabType].name} 🚗
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Transport;