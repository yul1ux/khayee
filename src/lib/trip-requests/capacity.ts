type CapacityTrip = {
  id: string;
  title: string;
  status: string;
  capacity: number;
};

type CapacityRequest = {
  tripId: string;
  partySize: number;
  status: string;
};

export type OrganizerTripCapacity = {
  tripId: string;
  tripTitle: string;
  tripStatus: string;
  capacity: number;
  acceptedParticipants: number;
  remainingCapacity: number;
};

export function summarizeTripRequestCapacity(
  trips: CapacityTrip[],
  requests: CapacityRequest[],
): OrganizerTripCapacity[] {
  const acceptedByTrip = new Map<string, number>();
  for (const request of requests) {
    if (request.status === "accepted") {
      acceptedByTrip.set(
        request.tripId,
        (acceptedByTrip.get(request.tripId) ?? 0) + request.partySize,
      );
    }
  }

  return trips.map((trip) => {
    const acceptedParticipants = acceptedByTrip.get(trip.id) ?? 0;
    return {
      tripId: trip.id,
      tripTitle: trip.title,
      tripStatus: trip.status,
      capacity: trip.capacity,
      acceptedParticipants,
      remainingCapacity: Math.max(0, trip.capacity - acceptedParticipants),
    };
  });
}
