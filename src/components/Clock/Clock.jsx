import React, { useEffect, useState } from 'react';

const Clock = () => {
    const [time , setTime]  = useState(new Date());

    useEffect( () => {
        setInterval (() => {
            setTime(new Date());
        }, 1000);
    }, []);

    const hours = time.getHours();

    const isNight = hours >= 19 || hours < 6;

    return (
        <div className='bg-accent-300'>
            <h2>Current Time</h2>

            <h1 className='font-bold text-5xl text-red-500 text-center'>{time.toLocaleTimeString()}</h1>
            
            <h1 className='font-semibold text-2xl text-red-400 text-center'>{isNight ? "Good Night" : "Good Day"}</h1>
            <p>{time.toLocaleDateString()}</p>
        </div>
    );
};

export default Clock;