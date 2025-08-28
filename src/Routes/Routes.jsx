import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../Layout/MainLayout";
import SignIn from "../components/Auth/Login/SignIn";
import SignUp from "../components/Auth/registration/SignUp";

const router = createBrowserRouter([
    {
        path: '/',
        element: <MainLayout />,
        children: [
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