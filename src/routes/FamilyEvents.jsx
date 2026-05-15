import Events from './Events.jsx';

export default function FamilyEvents() {
  return (
    <Events
      initialKindFilter="FamilyEvent"
      showKindFilter={false}
      showPersonEventCreate={false}
      showFamilyEventCreate={true}
    />
  );
}
