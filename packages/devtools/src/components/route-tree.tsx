import { useState, useEffect, useMemo } from "react";
import type { Route, Match } from "@typeroute/router";
import { styles } from "../styles";
import { ChevronDown, ChevronRight } from "./icons";

interface RouteTreeProps {
  routes: ReadonlyArray<Route>;
  currentMatch: Match | null;
  selectedRoute: Route | null;
  onSelectRoute: (route: Route) => void;
}

interface RouteNode {
  pattern: string;
  route: Route | null;
  children: RouteNode[];
}

export function RouteTree({
  routes,
  currentMatch,
  selectedRoute,
  onSelectRoute
}: RouteTreeProps) {
  const tree = useMemo(() => buildTree(routes), [routes]);
  const activeSet = useMemo(() => {
    if (!currentMatch) return new Set<Route>();
    const matched = currentMatch.route._.pattern;
    return new Set(routes.filter(r => isPathPrefix(r._.pattern, matched)));
  }, [currentMatch, routes]);

  return (
    <div>
      {tree.map(node => (
        <RouteTreeNode
          key={node.pattern}
          node={node}
          parentPattern={null}
          depth={0}
          activeRoute={currentMatch?.route}
          activeSet={activeSet}
          selectedRoute={selectedRoute}
          onSelect={onSelectRoute}
        />
      ))}
    </div>
  );
}

interface RouteTreeNodeProps {
  node: RouteNode;
  parentPattern: string | null;
  depth: number;
  activeRoute?: Route;
  activeSet: Set<Route>;
  selectedRoute: Route | null;
  onSelect: (route: Route) => void;
}

function RouteTreeNode({
  node,
  parentPattern,
  activeRoute,
  activeSet,
  depth,
  selectedRoute,
  onSelect
}: RouteTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const active = node.route
    ? activeSet.has(node.route)
    : !!activeRoute && isPathPrefix(node.pattern, activeRoute._.pattern);
  const selected = !!node.route && selectedRoute === node.route;
  const leafActive = !!node.route && activeRoute === node.route;
  const status = leafActive ? "active" : active ? "matched" : "inactive";
  const pattern = relativePattern(node.pattern, parentPattern);
  const label = !node.route
    ? "layout"
    : pattern.includes("*")
    ? "catch-all"
    : null;

  useEffect(() => {
    if (active && hasChildren) setExpanded(true);
  }, [active, hasChildren]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() =>
          node.route ? onSelect(node.route) : setExpanded(!expanded)
        }
        style={styles.routeTreeItem({ selected, active: leafActive, depth })}
      >
        <button
          tabIndex={hasChildren ? 0 : -1}
          aria-label={expanded ? "Collapse" : "Expand"}
          style={styles.expandButton(hasChildren)}
          onClick={e => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <span style={styles.routeIndicator(status)} />
        <code style={styles.routeTreePattern(!!node.route)}>
          {pattern}
          {label && <span style={styles.routeTreeLabel}>({label})</span>}
        </code>
      </div>
      {expanded &&
        node.children.map(child => (
          <RouteTreeNode
            key={child.pattern}
            node={child}
            parentPattern={node.pattern}
            depth={depth + 1}
            activeRoute={activeRoute}
            activeSet={activeSet}
            selectedRoute={selectedRoute}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function isPathPrefix(prefix: string, path: string): boolean {
  return (
    prefix === path || path.startsWith(prefix === "/" ? "/" : prefix + "/")
  );
}

function relativePattern(pattern: string, parent: string | null): string {
  if (!parent) return pattern;
  return pattern.substring(parent === "/" ? 1 : parent.length + 1) || "/";
}

function buildTree(routes: ReadonlyArray<Route>): RouteNode[] {
  const routeByPattern = new Map(routes.map(r => [r._.pattern, r]));
  const nodeByPattern = new Map<string, RouteNode>();

  for (const route of routes) {
    for (const prefix of prefixPatterns(route._.pattern)) {
      if (!nodeByPattern.has(prefix)) {
        nodeByPattern.set(prefix, {
          pattern: prefix,
          route: routeByPattern.get(prefix) ?? null,
          children: []
        });
      }
    }
  }

  const roots: RouteNode[] = [];
  for (const [pattern, node] of nodeByPattern) {
    const parentKey =
      pattern === "/"
        ? null
        : pattern.substring(0, pattern.lastIndexOf("/")) || "/";
    const parent = parentKey ? nodeByPattern.get(parentKey) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (nodes: RouteNode[]) => {
    nodes.sort((a, b) => a.pattern.localeCompare(b.pattern));
    nodes.forEach(n => sort(n.children));
  };
  sort(roots);

  return compress(roots);
}

function prefixPatterns(pattern: string): string[] {
  if (pattern === "/") return ["/"];
  const segments = pattern.split("/").filter(Boolean);
  const result = ["/"];
  for (let i = 0; i < segments.length; i++) {
    result.push("/" + segments.slice(0, i + 1).join("/"));
  }
  return result;
}

function compress(nodes: RouteNode[]): RouteNode[] {
  return nodes.flatMap(node => {
    node.children = compress(node.children);
    return !node.route && node.children.length === 1 ? node.children : [node];
  });
}
