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
        <div>
      <h1>{time} sec</h1>

      {!isRunning && time > 0 && (
        <button onClick={() => setIsRunning(true)}>Start</button>
      )}

      {isRunning && (
        <button onClick={() => setIsRunning(false)}>Pause</button>
      )}

      <button onClick={() => { setIsRunning(false); setTime(10); }}>
        Reset
      </button>
    </div>
    );
};

export default Timer;