import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
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

// Component to update map center
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

    const cabFares = {
        auto: { base: 25, perKm: 12, name: 'Auto' },
        mini: { base: 40, perKm: 14, name: 'Mini Cab' },
        sedan: { base: 50, perKm: 18, name: 'Sedan' },
    };

    // Get user location
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                setLoading(false);
            },
            () => {
                // Default to Hyderabad if location denied
                setUserLocation([17.3850, 78.4867]);
                setLoading(false);
            }
        );
    }, []);

    // Find nearby theatres using Nominatim
    useEffect(() => {
        if (!userLocation) return;
        const fetchTheatres = async () => {
    try {
        const [lat, lon] = userLocation;
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=cinema&lat=${lat}&lon=${lon}&format=json&limit=8&countrycodes=in&addressdetails=1`
        );
        const data = await res.json();
        
        if (data.length === 0) {
            // Broaden search if nothing found nearby
            const res2 = await fetch(
                `https://nominatim.openstreetmap.org/search?q=cinema+Allahabad&format=json&limit=8&countrycodes=in`
            );
            const data2 = await res2.json();
            setTheatres(data2.map(t => ({
                name: t.display_name.split(',')[0],
                lat: parseFloat(t.lat),
                lon: parseFloat(t.lon),
                address: t.display_name
            })));
        } else {
            setTheatres(data.map(t => ({
                name: t.display_name.split(',')[0],
                lat: parseFloat(t.lat),
                lon: parseFloat(t.lon),
                address: t.display_name
            })));
        }
    } catch (error) {
        console.error('Error fetching theatres:', error);
    }
};
        fetchTheatres();
    }, [userLocation]);

    // Get route using OSRM
    const getRoute = async (theatre) => {
        setSelectedTheatre(theatre);
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

    if (loading) return (
        <div className='flex items-center justify-center min-h-screen'>
            <p className='text-gray-400'>Getting your location...</p>
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

                            {/* User location marker */}
                            <Marker position={userLocation} icon={userIcon}>
                                <Popup>📍 Your Location</Popup>
                            </Marker>

                            {/* Theatre markers */}
                            {theatres.map((theatre, idx) => (
                                <Marker key={idx}
                                    position={[theatre.lat, theatre.lon]}
                                    icon={theatreIcon}
                                    eventHandlers={{ click: () => getRoute(theatre) }}>
                                    <Popup>
                                        🎬 {theatre.name}<br />
                                        <small>{theatre.address}</small>
                                    </Popup>
                                </Marker>
                            ))}

                            {/* Route */}
                            {route && <Polyline positions={route}
                                color="#e11d48" weight={4} />}
                        </MapContainer>
                    )}
                </div>

                {/* Sidebar */}
                <div className='lg:w-80 flex flex-col gap-4'>

                    {/* Nearby Theatres */}
                    <div className='bg-primary/10 border border-primary/20 rounded-xl p-4'>
                        <p className='font-semibold mb-3'>🎭 Nearby Theatres</p>
                        {theatres.length === 0 ? (
                            <p className='text-gray-400 text-sm'>Searching theatres...</p>
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

                            {/* Cab type selector */}
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

                            <div className='flex items-center justify-between'>
                                <p className='text-gray-400 text-sm'>Estimated Fare:</p>
                                <p className='text-2xl font-bold text-primary'>₹{fare}</p>
                            </div>

                            <button className='w-full mt-4 py-3 bg-primary hover:bg-primary-dull
                                transition rounded-lg text-sm font-medium cursor-pointer'>
                                Book {cabFares[cabType].name} 🚗
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Transport