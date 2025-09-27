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
        <div className='card text-center'>
            <h2 className='text-neutral-300 mb-2'>Current Time</h2>
            <h1 className='font-bold text-5xl text-white'>{time.toLocaleTimeString()}</h1>
            <h1 className='font-semibold text-2xl text-neutral-300 mt-2'>{isNight ? "Good Night" : "Good Day"}</h1>
            <p className='text-neutral-400 mt-1'>{time.toLocaleDateString()}</p>
        </div>
    );
};

export default Clock;
