import React, { useState, useEffect } from 'react';
import { CalendarEvent, School } from '../../types';
import { api } from '../../services/api';
import { CalendarDays, MapPin, PencilLine, Trash2 } from 'lucide-react';
import { toDateTimeInputValue, ToastApi } from './shared';

interface EventsTabProps {
  schools: School[];
  toast: ToastApi;
}

export const EventsTab: React.FC<EventsTabProps> = ({ schools, toast }) => {
  const [selectedEventSchoolId, setSelectedEventSchoolId] = useState('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartAt, setEventStartAt] = useState('');
  const [eventEndAt, setEventEndAt] = useState('');

  // Default to the first school once the list is available.
  useEffect(() => {
    setSelectedEventSchoolId((current) => current || schools[0]?.id || '');
  }, [schools]);

  useEffect(() => {
    if (!selectedEventSchoolId) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const res = await api.getCalendarEvents(selectedEventSchoolId);
        if (cancelled) return;
        if (res.ok) {
          setEvents(res.data || []);
        } else {
          setEvents([]);
          toast.error(res.message || 'Failed to load events');
        }
      } catch (error: any) {
        if (cancelled) return;
        console.error('Failed to fetch events:', error);
        setEvents([]);
        toast.error(error?.message || 'Failed to load events');
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };

    loadEvents();
    return () => { cancelled = true; };
  }, [selectedEventSchoolId]);

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventDescription('');
    setEventLocation('');
    setEventStartAt('');
    setEventEndAt('');
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setSelectedEventSchoolId(event.schoolId);
    setEventTitle(event.title);
    setEventDescription(event.description || '');
    setEventLocation(event.location || '');
    setEventStartAt(toDateTimeInputValue(event.startAt));
    setEventEndAt(toDateTimeInputValue(event.endAt));
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEventSchoolId) {
      toast.warning('Select a school first');
      return;
    }
    if (!eventTitle.trim() || !eventStartAt) {
      toast.warning('Title and start date are required');
      return;
    }

    setEventSaving(true);
    try {
      const payload = {
        schoolId: selectedEventSchoolId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        location: eventLocation.trim() || undefined,
        startAt: new Date(eventStartAt).toISOString(),
        endAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
      };

      const res = editingEventId
        ? await api.updateCalendarEvent(editingEventId, payload)
        : await api.createCalendarEvent(payload);

      if (!res.ok) {
        toast.error(res.message || 'Failed to save event');
        return;
      }

      setEvents((prev) => {
        const next = editingEventId
          ? prev.map((item) => (item.id === editingEventId ? res.data : item))
          : [...prev, res.data];
        return [...next].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      });
      toast.success(editingEventId ? 'Event updated' : 'Event created');
      resetEventForm();
    } catch (error: any) {
      console.error('Failed to save event:', error);
      toast.error(error?.message || 'Failed to save event');
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedEventSchoolId) return;

    try {
      const res = await api.deleteCalendarEvent(eventId, selectedEventSchoolId);
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete event');
        return;
      }

      setEvents((prev) => prev.filter((item) => item.id !== eventId));
      if (editingEventId === eventId) {
        resetEventForm();
      }
      toast.success('Event deleted');
    } catch (error: any) {
      console.error('Failed to delete event:', error);
      toast.error(error?.message || 'Failed to delete event');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="text-amber-500" size={22} />
            Event Control Room
          </h2>
          <p className="text-sm text-slate-500 mt-1">Create or update school-specific calendar entries.</p>
        </div>

        <div>
          <label htmlFor="event-school" className="block text-xs font-medium text-slate-500 mb-1">School</label>
          <select
            id="event-school" name="event-school"
            value={selectedEventSchoolId}
            onChange={(e) => {
              setSelectedEventSchoolId(e.target.value);
              resetEventForm();
            }}
            className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
          >
            <option value="">Select a school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div>
            <label htmlFor="event-title" className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input
              id="event-title" name="event-title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
              placeholder="e.g. Inter-house sports"
            />
          </div>

          <div>
            <label htmlFor="event-location" className="block text-xs font-medium text-slate-500 mb-1">Location</label>
            <input
              id="event-location" name="event-location"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
              placeholder="School main field"
            />
          </div>

          <div>
            <label htmlFor="event-description" className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea
              id="event-description" name="event-description"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              rows={4}
              className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
              placeholder="What should staff and students know?"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-start" className="block text-xs font-medium text-slate-500 mb-1">Start</label>
              <input
                id="event-start" name="event-start"
                type="datetime-local"
                value={eventStartAt}
                onChange={(e) => setEventStartAt(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
              />
            </div>
            <div>
              <label htmlFor="event-end" className="block text-xs font-medium text-slate-500 mb-1">End</label>
              <input
                id="event-end" name="event-end"
                type="datetime-local"
                value={eventEndAt}
                onChange={(e) => setEventEndAt(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            {editingEventId && (
              <button
                type="button"
                onClick={resetEventForm}
                className="px-4 py-2.5 bg-white text-slate-600 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel edit
              </button>
            )}
            <button
              type="submit"
              disabled={eventSaving}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-70"
            >
              {eventSaving ? 'Saving...' : editingEventId ? 'Update event' : 'Create event'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Scheduled Events</h3>
            <p className="text-sm text-slate-500">
              {selectedEventSchoolId
                ? `Showing ${schools.find((school) => school.id === selectedEventSchoolId)?.name || 'selected school'}`
                : 'Pick a school to manage its events.'}
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {events.length} events
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {eventsLoading ? (
            [1, 2, 3].map((item) => (
              <div key={item} className="px-6 py-5">
                <div className="h-4 bg-slate-100 rounded animate-pulse mb-3"></div>
                <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3"></div>
              </div>
            ))
          ) : !selectedEventSchoolId ? (
            <div className="px-6 py-10 text-sm text-slate-500 text-center">Select a school to begin.</div>
          ) : events.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500 text-center">No calendar events have been created for this school yet.</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="px-6 py-5 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">{event.title}</h4>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {new Date(event.startAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {new Date(event.startAt).toLocaleString()}
                    {event.endAt ? ` to ${new Date(event.endAt).toLocaleString()}` : ''}
                  </div>
                  {event.location && (
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      {event.location}
                    </div>
                  )}
                  {event.description && <p className="text-sm text-slate-500 max-w-2xl">{event.description}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditEvent(event)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit event"
                  >
                    <PencilLine size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(event.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete event"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
