'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PillSelector from './PillSelector';

interface Person {
  id: string;
  fullName: string;
}

interface Member extends Person {
  // Member is a person already in the group
}

interface GroupMembersManagerProps {
  groupId: string;
  groupName: string;
  currentMembers: Member[];
  availablePeople: Person[];
}

export default function GroupMembersManager({
  groupId,
  groupName,
  currentMembers,
  availablePeople,
}: GroupMembersManagerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Transform people to PillItem format
  const pillItems = availablePeople.map((person) => ({
    id: person.id,
    label: person.fullName,
  }));

  const selectedItems = currentMembers.map((member) => ({
    id: member.id,
    label: member.fullName,
  }));

  const handleAdd = async (item: { id: string; label: string }) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: item.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to add member');
        return;
      }

      toast.success(`${item.label} added to ${groupName}`);
      router.refresh();
    } catch (error) {
      toast.error('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (itemId: string) => {
    const member = currentMembers.find((m) => m.id === itemId);
    if (!member) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove member');
        return;
      }

      toast.success(`${member.fullName} removed from ${groupName}`);
      router.refresh();
    } catch (error) {
      toast.error('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PillSelector
      label={`Members (${currentMembers.length})`}
      selectedItems={selectedItems}
      availableItems={pillItems}
      onAdd={handleAdd}
      onRemove={handleRemove}
      placeholder="Type a name to add members..."
      emptyMessage="No people found matching"
      helpText="Type to search for people and press Enter to add them. Click × to remove members."
      isLoading={isLoading}
    />
  );
}
