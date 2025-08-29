import React from 'react';
import { Link } from 'react-router';

const Banner = () => {
    return (
        <div className='text-center p-8 bg-neutral-300'>
            <h1>Welcome to the Time Tracker</h1>
            <p>Keep track of your time efficiently.</p>
            <button className='btn btn-primary border-2 mt-4'>
                <Link to="/start-tracking">Live Clock</Link>
            </button>
            
        </div>
    );
};

export default Banner;