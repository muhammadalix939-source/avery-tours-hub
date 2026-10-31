import { useState } from "react";
import { Plus, Hotel, Plane, Car, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Booking, Client } from "@/lib/data";
import { useStore } from "@/lib/store";
import { generateHotelVoucher, generateFlightVoucher, generateTransportVoucher } from "@/lib/pdf";

type FormType = null | "hotel" | "flight" | "transport";

export default function BookingServicesMenu({ booking, clients }: { booking: Booking; clients: Client[] }) {
  const store = useStore();
  const [open, setOpen] = useState<FormType>(null);

  const [hotel, setHotel] = useState({ city: "Makkah", hotelName: "", roomType: "", checkIn: "", checkOut: "", nights: "" });
  const [flight, setFlight] = useState({ date: "", flightNo: "", from: "", to: "", departure: "", arrival: "" });
  const [transport, setTransport] = useState({ service: "Airport Transfer", route: "", vehicle: "Private Car", date: "" });

  function reset() { setOpen(null); }

  function saveHotel() {
    if (!hotel.hotelName) return;
    store.addHotel(booking.id, {
      city: hotel.city,
      hotelName: hotel.hotelName,
      roomType: hotel.roomType || "1 Quad",
      checkIn: hotel.checkIn,
      checkOut: hotel.checkOut,
      nights: Number(hotel.nights) || 0,
    });
    setHotel({ city: "Makkah", hotelName: "", roomType: "", checkIn: "", checkOut: "", nights: "" });
    reset();
  }

  function saveFlight() {
    if (!flight.flightNo) return;
    store.addFlight(booking.id, { ...flight });
    setFlight({ date: "", flightNo: "", from: "", to: "", departure: "", arrival: "" });
    reset();
  }

  function saveTransport() {
    if (!transport.route) return;
    store.addTransport(booking.id, { ...transport });
    setTransport({ service: "Airport Transfer", route: "", vehicle: "Private Car", date: "" });
    reset();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded p-1 hover:bg-accent" title="Add Service">
            <Plus className="h-3.5 w-3.5 text-primary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">Add Service</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setOpen("hotel")} className="gap-2 text-xs">
            <Hotel className="h-3.5 w-3.5 text-primary" /> Add Hotel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("flight")} className="gap-2 text-xs">
            <Plane className="h-3.5 w-3.5 text-primary" /> Add Flight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen("transport")} className="gap-2 text-xs">
            <Car className="h-3.5 w-3.5 text-primary" /> Add Transport
          </DropdownMenuItem>

          {(booking.hotels?.length || booking.flights?.length || booking.transports?.length) ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Manage</DropdownMenuLabel>
              {booking.hotels?.map((h) => (
                <DropdownMenuItem key={h.id} onClick={() => store.deleteHotel(booking.id, h.id)} className="gap-2 text-xs">
                  <Trash2 className="h-3 w-3 text-destructive" /> Remove {h.city} — {h.hotelName}
                </DropdownMenuItem>
              ))}
              {booking.flights?.map((f) => (
                <DropdownMenuItem key={f.id} onClick={() => store.deleteFlight(booking.id, f.id)} className="gap-2 text-xs">
                  <Trash2 className="h-3 w-3 text-destructive" /> Remove Flight {f.flightNo}
                </DropdownMenuItem>
              ))}
              {booking.transports?.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => store.deleteTransport(booking.id, t.id)} className="gap-2 text-xs">
                  <Trash2 className="h-3 w-3 text-destructive" /> Remove {t.service}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* HOTEL FORM */}
      <Dialog open={open === "hotel"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Add Hotel — {booking.headId}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">City</Label><Input value={hotel.city} onChange={(e) => setHotel({ ...hotel, city: e.target.value })} placeholder="Makkah / Madinah" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Room Type</Label><Input value={hotel.roomType} onChange={(e) => setHotel({ ...hotel, roomType: e.target.value })} placeholder="1 Quad" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Hotel Name</Label><Input value={hotel.hotelName} onChange={(e) => setHotel({ ...hotel, hotelName: e.target.value })} placeholder="Noor Al Mashair" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Check-In</Label><Input type="date" value={hotel.checkIn} onChange={(e) => setHotel({ ...hotel, checkIn: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Check-Out</Label><Input type="date" value={hotel.checkOut} onChange={(e) => setHotel({ ...hotel, checkOut: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Nights</Label><Input type="number" value={hotel.nights} onChange={(e) => setHotel({ ...hotel, nights: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
            <Button onClick={saveHotel} className="w-full">Save Hotel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* FLIGHT FORM */}
      <Dialog open={open === "flight"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Add Flight — {booking.headId}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={flight.date} onChange={(e) => setFlight({ ...flight, date: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Flight No</Label><Input value={flight.flightNo} onChange={(e) => setFlight({ ...flight, flightNo: e.target.value })} placeholder="XY638" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">From</Label><Input value={flight.from} onChange={(e) => setFlight({ ...flight, from: e.target.value })} placeholder="Karachi" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">To</Label><Input value={flight.to} onChange={(e) => setFlight({ ...flight, to: e.target.value })} placeholder="Jeddah" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Departure</Label><Input value={flight.departure} onChange={(e) => setFlight({ ...flight, departure: e.target.value })} placeholder="13:15" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Arrival</Label><Input value={flight.arrival} onChange={(e) => setFlight({ ...flight, arrival: e.target.value })} placeholder="16:05" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
            <Button onClick={saveFlight} className="w-full">Save Flight</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TRANSPORT FORM */}
      <Dialog open={open === "transport"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Add Transport — {booking.headId}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Service</Label><Input value={transport.service} onChange={(e) => setTransport({ ...transport, service: e.target.value })} placeholder="Airport Transfer" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
              <div><Label className="text-xs">Vehicle</Label><Input value={transport.vehicle} onChange={(e) => setTransport({ ...transport, vehicle: e.target.value })} placeholder="Private Car" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Route</Label><Input value={transport.route} onChange={(e) => setTransport({ ...transport, route: e.target.value })} placeholder="JED Airport - Makkah Hotel" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={transport.date} onChange={(e) => setTransport({ ...transport, date: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
            <Button onClick={saveTransport} className="w-full">Save Transport</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================
//  VoucherDownloadMenu — dropdown listing each saved hotel
//  + flights, transport, "All-in-one"
// =============================================================
export function VoucherDownloadMenu({ booking, clients }: { booking: Booking; clients: Client[] }) {
  const hasAny = (booking.hotels?.length || 0) + (booking.flights?.length || 0) + (booking.transports?.length || 0) > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1 hover:bg-accent" title="Download Vouchers">
          <Download className="h-3.5 w-3.5 text-success" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {!hasAny && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No services added yet
          </DropdownMenuItem>
        )}

        {booking.hotels && booking.hotels.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs">Hotel Vouchers</DropdownMenuLabel>
            {booking.hotels.map((h, i) => (
              <DropdownMenuItem
                key={h.id}
                className="gap-2 text-xs"
                onClick={() => generateHotelVoucher(booking, clients, [h], { voucherSuffix: `-${i + 1}` })}
              >
                <Hotel className="h-3.5 w-3.5 text-primary" /> {h.city} — {h.hotelName}
              </DropdownMenuItem>
            ))}
            {booking.hotels.length > 1 && (
              <DropdownMenuItem
                className="gap-2 text-xs font-semibold"
                onClick={() => generateHotelVoucher(booking, clients, booking.hotels!, { transports: booking.transports, flights: booking.flights })}
              >
                <Download className="h-3.5 w-3.5 text-success" /> Download All Hotels
              </DropdownMenuItem>
            )}
          </>
        )}

        {booking.flights && booking.flights.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={() => generateFlightVoucher(booking, clients, booking.flights!)}
            >
              <Plane className="h-3.5 w-3.5 text-primary" /> Flight Voucher
            </DropdownMenuItem>
          </>
        )}

        {booking.transports && booking.transports.length > 0 && (
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() => generateTransportVoucher(booking, clients, booking.transports!)}
          >
            <Car className="h-3.5 w-3.5 text-primary" /> Transport Voucher
          </DropdownMenuItem>
        )}

        {hasAny && (booking.hotels?.length || 0) >= 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs font-semibold"
              onClick={() => generateHotelVoucher(booking, clients, booking.hotels || [], { transports: booking.transports, flights: booking.flights })}
            >
              <Download className="h-3.5 w-3.5 text-success" /> Combined Voucher (Hotel + Flight + Transport)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}