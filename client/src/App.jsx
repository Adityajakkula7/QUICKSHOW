import React from 'react'
import Navbar from './components/Navbar'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Movies from './pages/Movies'
import MovieDetails from './pages/MovieDetails'
import SeatLayout from './pages/SeatLayout'
import MyBookings from './pages/MyBookings'
import Favorite from './pages/Favorite'
import {Toaster} from 'react-hot-toast'
import Footer from './components/Footer'
import Releases from './pages/Releases'
import Layout from './pages/admin/Layout'
import AddShows from './pages/admin/AddShows'
import ListShows from './pages/admin/ListShows'
import ListBookings from './pages/admin/ListBookings'
import Dashboard from './pages/admin/Dashboard'
import Transport from './pages/Transport'
import Login from './pages/Login'
import Register from './pages/Register'


const App = () => {
  const isAdminRoute = useLocation().pathname.startsWith('/admin');

  return (
    <>
      <Toaster/>
      {!isAdminRoute && <Navbar/>}
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/movies" element={<Movies/>}/>
        <Route path="/movies/:id" element={<MovieDetails/>}/>
        <Route path="/movies/:id/:date" element={<SeatLayout/>}/>
        <Route path="/my-bookings" element={<MyBookings/>}/>
        <Route path="/releases" element={<Releases/>}/>
        <Route path="/favorite" element={<Favorite/>}/>
        <Route path="/login" element={<Login/>}/>
        <Route path="/register" element={<Register/>}/>
        <Route path = '/admin/*' element = {<Layout/>}>
          <Route index element={<Dashboard/>} />
          <Route path="add-shows" element={<AddShows/>} />
          <Route path="list-shows" element={<ListShows/>} />
          <Route path="list-bookings" element={<ListBookings/>} />
        </Route>
        <Route path='/transport' element={<Transport />} />
      </Routes>
      {!isAdminRoute && <Footer/>}
    </>
  )
}

export default App
