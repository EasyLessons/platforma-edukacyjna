/**
 * WORKSPACE EMPTY STATE
 *
 * Komponent wyświetlany gdy użytkownik nie ma jeszcze żadnych workspace'ów.
 * Zachęca do utworzenia pierwszego workspace'a.
 *
 */

'use client';

import { Users, Calendar, FileText, Plus } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';

interface WorkspaceEmptyStateProps {
  onCreateClick: () => void;
  variant?: 'full' | 'compact';
}

export function WorkspaceEmptyState({ onCreateClick, variant = 'full' }: WorkspaceEmptyStateProps) {
  // Compact version
  if (variant === 'compact') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Button
          size="icon"
          onClick={onCreateClick}
          title="Stwórz pierwszą przestrzeń"
          className="w-12 h-12"
        >
          <Plus size={24} />
        </Button>
      </div>
    );
  }

  // Full version
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <Users size={40} className="text-green-600" />
      </div>

      {/* Heading */}
      <h3 className="text-2xl font-bold text-gray-900 mb-3">Stwórz swoją pierwszą przestrzeń</h3>

      {/* Description */}
      <p className="text-gray-600 mb-2 max-w-md">
        Przestrzenie pomagają organizować Twoją pracę i współpracować z innymi.
      </p>

      {/* Features */}
      <div className="flex items-center gap-6 mt-6 mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar size={18} className="text-green-600" />
          <span>Planuj</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText size={18} className="text-green-600" />
          <span>Organizuj</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users size={18} className="text-green-600" />
          <span>Współpracuj</span>
        </div>
      </div>

      {/* CTA Button */}
      <Button size="lg" leftIcon={<Plus size={20} />} onClick={onCreateClick} className="mb-4">
        Stwórz pierwszą przestrzeń
      </Button>

      {/* Helper text */}
      <p className="text-xs text-gray-500 max-w-xs">
        Możesz później zaprosić członków zespołu i dodawać tablice
      </p>
    </div>
  );
}
