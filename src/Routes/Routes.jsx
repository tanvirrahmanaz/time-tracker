import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../Layout/MainLayout";
import SignIn from "../components/Auth/Login/SignIn";
import SignUp from "../components/Auth/registration/SignUp";
import HomeLayout from "../components/Home/HomeLayout";
import Clock from "../components/Clock/Clock";
import Timer from "../components/Clock/Timer";
import Projects from "../components/Projects/Projects";
import ProjectDetail from "../components/Projects/ProjectDetail";
import Spend from "../components/Spend/Spend";
import Daily from "../components/Daily/Daily";
import QuestionHub from "../components/Questions/QuestionHub";
import ProtectedRoute from "../components/Auth/ProtectedRoute";

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
                path: '/start-timer',
                element: <Timer></Timer>
            },
            {
                path: '/projects',
                element: (
                    <ProtectedRoute>
                        <Projects />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/projects/:id',
                element: (
                    <ProtectedRoute>
                        <ProjectDetail />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/spend',
                element: (
                    <ProtectedRoute>
                        <Spend />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/questions',
                element: (
                    <ProtectedRoute>
                        <QuestionHub />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/daily',
                element: (
                    <ProtectedRoute>
                        <Daily />
                    </ProtectedRoute>
                ),
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
