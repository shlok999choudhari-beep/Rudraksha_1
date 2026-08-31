import React from 'react';
import {
  useNavigate,
  useLocation,
  useSearchParams as useRRSearchParams,
  Link as RRLink,
  type LinkProps as RRLinkProps,
} from 'react-router-dom';

/**
 * Next.js navigation compatibility hooks for React Router.
 */
export function redirect(url: string) {
  if (typeof window !== 'undefined') {
    window.location.replace(url);
  }
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const [searchParams] = useRRSearchParams();
  return searchParams;
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  // Basic param extraction for /cases/:caseId and /screening/:caseId
  const caseId = parts[1] || '';
  return { caseId } as unknown as T;
}

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, ...props }, ref) => {
    return (
      <RRLink ref={ref} to={href} {...props}>
        {children}
      </RRLink>
    );
  }
);

Link.displayName = 'Link';
export default Link;
