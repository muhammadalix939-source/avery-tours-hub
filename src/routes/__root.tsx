import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import AppSidebar from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="gold-text text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Avery International Travel & Tours — Operations Suite" },
      { name: "description", content: "Enterprise Travel Agency CRM, Accounts & Ledger System" },
      { property: "og:title", content: "Avery International Travel & Tours" },
      { name: "twitter:title", content: "Avery International Travel & Tours" },
      { property: "og:description", content: "Curated journeys. Trusted service. Worldwide reach." },
      { name: "twitter:description", content: "Curated journeys. Trusted service. Worldwide reach." },
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Must match --font-display / --font-body in styles.css (they were never loaded before).
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=='undefined'&&!window.$_TSR){window.$_TSR={h:function(){this.hydrated=true;},e:function(){this.streamEnded=true;},c:function(){},p:function(s){if(this.initialized)s();else this.buffer.push(s);},buffer:[],router:{manifest:{},dehydratedData:null,matches:[]}};}`
          }}
        />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="min-w-0 flex-1 px-4 pb-8 pt-20 md:ml-[260px] md:px-8 md:pt-8">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" richColors closeButton expand={false} duration={8500} />
    </div>
  );
}
