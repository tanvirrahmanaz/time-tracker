import React from 'react';
import { Link } from 'react-router';

const Navbar = () => {
    return (
        <div className='bg-neutral-200 p-4 mb-8'>
            <nav>
                <ul className='flex space-x-4 justify-center'>
                    <button className='btn btn-primary border-2'>
                        <Link to="/">Home</Link>
                    </button>
                    <li>About</li>
                    <li>Contact</li>
                    <button className='btn btn-primary border-2'>
                        <Link to="/sign-in">Sign In</Link>
                    </button>
                    <button className='btn btn-primary border-2'>
                        <Link to="/sign-up">Sign Up</Link>
                    </button>
                </ul>
            </nav>
        </div>
    );
};

export default Navbar;