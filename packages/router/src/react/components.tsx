import {
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useEffect,
  useSyncExternalStore,
  isValidElement,
  cloneElement,
  type ReactNode,
  type MouseEvent,
  type SyntheticEvent,
  type ReactEventHandler,
  type RefAttributes,
  type AnchorHTMLAttributes
} from "react";
import { useRouter, useOutlet, useMatch } from "./hooks";
import {
  RouterContext,
  LocationContext,
  MatchContext,
  OutletContext
} from "./contexts";
import { Router } from "../router";
import { mergeRefs, useEvent } from "../utils";
import type {
  RouterOptions,
  Pattern,
  NavigateOptions,
  LinkOptions
} from "../types";

// RouterRoot

export type RouterRootProps = RouterOptions | { router: Router };

export const RouterRoot = (props: RouterRootProps) => {
  const [router] = useState(() =>
    "router" in props ? props.router : new Router(props)
  );
  const { subscribe, location: get } = router.history;
  const location = useSyncExternalStore(subscribe, get, get);
  const match = useMemo(
    () => router.matchAll(location.path),
    [router, location.path]
  );
  if (!match) {
    console.error("[TypeRoute] No matching route for path", location.path);
  }
  return useMemo<ReactNode>(
    () => (
      <RouterContext.Provider value={router}>
        <LocationContext.Provider value={location}>
          <MatchContext.Provider value={match}>
            {match?.route._.components.reduceRight<ReactNode>(
              (acc, Comp) => (
                <OutletContext.Provider value={acc}>
                  <Comp />
                </OutletContext.Provider>
              ),
              null
            )}
          </MatchContext.Provider>
        </LocationContext.Provider>
      </RouterContext.Provider>
    ),
    [router, location, match]
  );
};

// Outlet

export const Outlet = () => {
  return useOutlet();
};

// Navigate

export type NavigateProps<P extends Pattern> = NavigateOptions<P>;

export const Navigate = <P extends Pattern>(props: NavigateProps<P>) => {
  const router = useRouter();
  useLayoutEffect(() => router.navigate(props), []);
  if (router.ssrContext) {
    router.ssrContext.redirect = router.createUrl(props);
  }
  return null;
};

// Link

export type LinkProps<P extends Pattern> = NavigateOptions<P> &
  LinkOptions &
  AnchorHTMLAttributes<HTMLAnchorElement> &
  RefAttributes<HTMLAnchorElement> & { asChild?: boolean };

export const Link = <P extends Pattern>(props: LinkProps<P>): ReactNode => {
  const router = useRouter();
  const {
    to,
    replace,
    state,
    params,
    search,
    strict,
    preload,
    preloadDelay = 50,
    style,
    className,
    activeStyle,
    activeClassName,
    asChild,
    children,
    ...rest
  } = {
    ...router.defaultLinkOptions,
    ...props
  };

  const ref = useRef<HTMLAnchorElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = router.createUrl(props);
  const active = !!useMatch({ from: to, strict, params });

  const cancelPreload = useEvent(() => {
    clearTimeout(timeoutRef.current!);
  });

  const schedulePreload = useEvent(() => {
    cancelPreload();
    timeoutRef.current = setTimeout(() => router.preload(props), preloadDelay);
  });

  useEffect(() => {
    if (preload === "render") {
      schedulePreload();
    } else if (preload === "viewport" && ref.current) {
      const observer = new IntersectionObserver(entries =>
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            schedulePreload();
          } else {
            cancelPreload();
          }
        })
      );
      observer.observe(ref.current);
      return () => {
        observer.disconnect();
        cancelPreload();
      };
    }
    return cancelPreload;
  }, [preload]);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    rest.onClick?.(event);
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button ||
      event.defaultPrevented
    )
      return;
    event.preventDefault();
    router.navigate({ url, replace, state });
  };

  const intentEvent =
    (action: () => void, handler?: ReactEventHandler<HTMLAnchorElement>) =>
    (e: SyntheticEvent<HTMLAnchorElement>) => {
      handler?.(e);
      preload === "intent" && !e.defaultPrevented && action();
    };

  const anchorProps = {
    ...rest,
    ref: mergeRefs(ref, rest.ref),
    href: url,
    onClick,
    onFocus: intentEvent(schedulePreload, rest.onFocus),
    onBlur: intentEvent(cancelPreload, rest.onBlur),
    onPointerEnter: intentEvent(schedulePreload, rest.onPointerEnter),
    onPointerLeave: intentEvent(cancelPreload, rest.onPointerLeave),
    ["data-active"]: active,
    style: { ...style, ...(active && activeStyle) },
    className:
      [className, active && activeClassName].filter(Boolean).join(" ") ||
      undefined
  };

  return asChild && isValidElement(children) ? (
    cloneElement(children, anchorProps)
  ) : (
    <a {...anchorProps}>{children}</a>
  );
};
