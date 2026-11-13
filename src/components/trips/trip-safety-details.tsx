type TripSafetyDetailsProps = {
  difficulty: string;
  durationMinutes: number;
  requiredEquipment: string[];
  includedServices: string[];
  excludedServices: string[];
  safetyInformation: string;
  cancellationPolicy: string;
  emergencyContactInformation: string | null;
};

function ListItems({ items }: { items: string[] }) {
  return items.length > 0 ? (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#51564e]">
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  ) : (
    <p className="mt-2 text-sm text-[#73776e]">Not specified by the organizer.</p>
  );
}

export function TripSafetyDetails({
  difficulty,
  durationMinutes,
  requiredEquipment,
  includedServices,
  excludedServices,
  safetyInformation,
  cancellationPolicy,
  emergencyContactInformation,
}: TripSafetyDetailsProps) {
  const duration = durationMinutes < 60
    ? `${durationMinutes} ${durationMinutes === 1 ? "minute" : "minutes"}`
    : durationMinutes >= 1440
    ? `${Math.ceil(durationMinutes / 1440)} ${Math.ceil(durationMinutes / 1440) === 1 ? "day" : "days"}`
    : `${Math.ceil(durationMinutes / 60)} ${Math.ceil(durationMinutes / 60) === 1 ? "hour" : "hours"}`;

  return (
    <section aria-labelledby="trip-safety-heading" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#29382d]" id="trip-safety-heading">Trip preparation and safety</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="font-semibold text-[#29382d]">Difficulty</dt><dd className="mt-1 capitalize text-[#51564e]">{difficulty}</dd></div>
          <div><dt className="font-semibold text-[#29382d]">Duration</dt><dd className="mt-1 text-[#51564e]">{duration}</dd></div>
        </dl>
      </div>
      <div>
        <h3 className="font-semibold text-[#29382d]">Safety and risk notes</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#51564e]">{safetyInformation}</p>
      </div>
      <div>
        <h3 className="font-semibold text-[#29382d]">Cancellation terms</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#51564e]">{cancellationPolicy}</p>
      </div>
      <div>
        <h3 className="font-semibold text-[#29382d]">Required equipment</h3>
        <ListItems items={requiredEquipment} />
      </div>
      <div>
        <h3 className="font-semibold text-[#29382d]">Included services</h3>
        <ListItems items={includedServices} />
      </div>
      <div>
        <h3 className="font-semibold text-[#29382d]">Not included</h3>
        <ListItems items={excludedServices} />
      </div>
      <div>
        <h3 className="font-semibold text-[#29382d]">Emergency contact information</h3>
        {emergencyContactInformation ? (
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#51564e]">{emergencyContactInformation}</p>
        ) : (
          <p className="mt-2 text-sm text-[#73776e]">Not provided by the organizer.</p>
        )}
      </div>
      <p className="border-l-2 border-[#b8c2a8] pl-3 text-xs leading-5 text-[#73776e]">
        Outdoor activities involve risk. Review the trip details, safety notes, and equipment requirements before requesting to join. Organizer verification is not a guarantee of trip safety.
      </p>
    </section>
  );
}
