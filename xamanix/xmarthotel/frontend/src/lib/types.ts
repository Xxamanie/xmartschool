export type Role = 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING' | 'ACCOUNTANT' | 'STAFF';

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  loyaltyTier: string;
}
export interface User { id: string; name: string; email: string; role: Role; propertyId: string | null; }
export type RoomStatus = 'Available' | 'Occupied' | 'Dirty' | 'Cleaning' | 'OutOfOrder';
export type ReservationStatus = 'Booked' | 'CheckedIn' | 'CheckedOut' | 'Cancelled' | 'NoShow';
export interface RoomType { id: string; name: string; basePriceMinor: number; capacity: number; amenities: string[]; }
export interface Room { id: string; number: string; floor: string; status: RoomStatus; roomTypeId: string; roomType?: { name: string; basePriceMinor: number }; }
export interface Reservation { id: string; status: ReservationStatus; checkIn: string; checkOut: string; ratePerNightMinor: number; source: string; guest?: { firstName: string; lastName: string; phone?: string | null }; roomType?: { name: string }; room?: { number: string } | null; }
export interface DashboardData { totalRooms: number; roomsByStatus: { available: number; occupied: number; dirty: number; cleaning: number; outOfOrder: number }; occupancyRate: number; adrMinor: number; revparMinor: number; arrivalsToday: number; departuresToday: number; inHouse: number; revenueTodayMinor: number; }
export interface HousekeepingTask { id: string; type: string; status: 'Pending' | 'InProgress' | 'Done' | 'Inspected'; room?: { number: string; status: RoomStatus }; }
export interface MenuItem { id: string; name: string; category: string; priceMinor: number; available: boolean; }
export interface KitchenOrder { id: string; status: 'Open' | 'Preparing' | 'Served' | 'Cancelled'; tableLabel?: string | null; reservationId?: string | null; createdAt: string; items: { id: string; quantity: number; priceMinor: number; menuItem?: { name: string } }[]; }
export interface InventoryItem { id: string; name: string; category: string; unit: string; quantity: number; reorderLevel: number; lowStock: boolean; }
export interface Department { id: string; name: string; _count?: { staff: number }; }
export interface StaffMember { id: string; name: string; title: string; phone?: string | null; department?: { name: string } | null; }
export interface Shift { id: string; start: string; end: string; role: string; staff?: { name: string }; }
export interface FolioCharge { id: string; description: string; amountMinor: number; quantity: number; }
export interface Payment { id: string; amountMinor: number; method: string; reference?: string | null; refunded: boolean; }
export interface Folio { id: string; status: 'Open' | 'Closed'; charges: FolioCharge[]; payments: Payment[]; chargesTotal: number; paymentsTotal: number; balanceMinor: number; reservation?: { guest?: { firstName: string; lastName: string }; room?: { number: string } | null }; }
