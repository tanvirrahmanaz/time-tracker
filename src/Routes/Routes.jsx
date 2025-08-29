import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../Layout/MainLayout";
import SignIn from "../components/Auth/Login/SignIn";
import SignUp from "../components/Auth/registration/SignUp";
import HomeLayout from "../components/Home/HomeLayout";
import Clock from "../components/Clock/Clock";

const router = createBrowserRouter([
    {
        path: '/',
        element: <MainLayout />,
        children: [
            {
                index: true,
                element: <HomeLayout />,
            },
            {
                path: '/start-tracking',
                element: <Clock></Clock>
            },
            {
                path: 'sign-in',
                element: <SignIn></SignIn>,
            },
            {
                path: 'sign-up',
                element: <SignUp></SignUp>,
            },
        ],
    },
])

export default router;