import React from 'react';

const Footer = () => {
    return (
        <div className='mt-10 border-t border-[#121212]'>
            <footer className='container py-6 text-center'>
                <p className='text-neutral-500'>&copy; {new Date().getFullYear()} Time Tracker</p>
            </footer>
        </div>
    );
};

export default Footer;
