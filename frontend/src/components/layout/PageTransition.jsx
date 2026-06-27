import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Resets scroll position on route change. The decorative glass curtain was
// removed in favour of rock solid reliability across browsers and devices.
export function PageTransition({ children }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <>{children}</>;
}

export default PageTransition;
