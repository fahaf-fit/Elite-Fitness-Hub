import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import Navbar from "@/components/Navbar";
import SessionDebugBadge from "@/components/SessionDebugBadge";
import Home from "@/pages/Home";
import Plans from "@/pages/Plans";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Profile from "@/pages/Profile";
import Workouts from "@/pages/Workouts";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

/** Runs a session check on every client-side route change */
function RouteChangeGuard() {
  const [location] = useLocation();
  const { user, runSessionCheck } = useAuth();

  useEffect(() => {
    if (user) {
      console.log("[session] route change →", location, "— running check");
      runSessionCheck();
    }
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function Router() {
  return (
    <>
      <RouteChangeGuard />
      <Navbar />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/plans" component={Plans} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/profile" component={Profile} />
        <Route path="/workouts" component={Workouts} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
      <SessionDebugBadge />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <LanguageProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <Router />
              </SubscriptionProvider>
            </AuthProvider>
          </LanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
