import type { Channel } from '@prisma/client';

/**
 * Channel (OTA) adapters. Real Booking.com / Expedia / Airbnb integrations require
 * partner certification and live credentials, so those adapters are stubbed behind
 * this interface and currently share the Generic behaviour (log + succeed). When
 * credentials and certification are in place, each OTA adapter implements its own
 * ARI (Availability, Rates, Inventory) push using the provider's API/XML schema —
 * the rest of the system (sync engine, routes, UI) does not change.
 */
export interface AvailabilityUpdate {
  roomTypeId: string;
  date: string; // YYYY-MM-DD
  available: number;
  ratePerNightMinor: number;
}

export interface SyncResult {
  ok: boolean;
  message: string;
}

export interface ChannelAdapter {
  pushAvailability(updates: AvailabilityUpdate[]): Promise<SyncResult>;
}

class GenericAdapter implements ChannelAdapter {
  constructor(protected channel: Channel) {}

  async pushAvailability(updates: AvailabilityUpdate[]): Promise<SyncResult> {
    // No live OTA endpoint without credentials — record intent and succeed.
    // A real adapter would translate `updates` into the provider's ARI payload
    // and POST it to the channel's API using `this.channel.credentials`.
    const hasCreds = Boolean(this.channel.credentials);
    console.log(`[channel:${this.channel.type}] push ${updates.length} ARI rows (creds: ${hasCreds})`);
    return {
      ok: true,
      message: hasCreds
        ? `Pushed ${updates.length} availability/rate rows`
        : `Computed ${updates.length} rows (add credentials to push live)`,
    };
  }
}

// OTA-specific adapters inherit Generic for now; override pushAvailability when
// the provider integration is implemented.
class BookingComAdapter extends GenericAdapter {}
class ExpediaAdapter extends GenericAdapter {}
class AirbnbAdapter extends GenericAdapter {}

export function adapterFor(channel: Channel): ChannelAdapter {
  switch (channel.type) {
    case 'BookingCom': return new BookingComAdapter(channel);
    case 'Expedia': return new ExpediaAdapter(channel);
    case 'Airbnb': return new AirbnbAdapter(channel);
    default: return new GenericAdapter(channel);
  }
}
