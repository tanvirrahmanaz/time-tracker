import React, { useEffect, useState } from 'react';

const Timer = () => {
    const [time , setTime] = useState(10);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() =>{
        let timerId;
        

        if(isRunning && time > 0){
            timerId = setInterval(() =>{
                setTime((prev) => prev-1);
                
            },1000);
            console.log('timerId', timerId);
        }
        return () => clearInterval(timerId);
    },[isRunning, time]) 

    


    return (
        <div className='card text-center'>
            <h2 className='text-neutral-300 mb-3'>Countdown Timer</h2>
            <h1 className='font-mono text-5xl text-white mb-4'>{time} sec</h1>
            <div className='flex items-center justify-center gap-2'>
                {!isRunning && time > 0 && (
                    <button className='btn btn-primary' onClick={() => setIsRunning(true)}>Start</button>
                )}
                {isRunning && (
                    <button className='btn btn-outline' onClick={() => setIsRunning(false)}>Pause</button>
                )}
                <button className='btn btn-outline' onClick={() => { setIsRunning(false); setTime(10); }}>
                    Reset
                </button>
            </div>
        </div>
    );
};

export default Timer;
