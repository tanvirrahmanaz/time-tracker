import React from 'react';
import {Outlet} from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import Footer from '../components/shared/Footer';
import RevisionAlertBar from '../components/Daily/RevisionAlertBar';

const MainLayout = () => {
    return (
        <div>
            <Navbar />
            <RevisionAlertBar />
            <main className='container py-8'>
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default MainLayout;
