'use client';

import React from 'react';
import { PetCareDock, type PetCareDockProps } from './PetCareDock';

export interface ActionButtonsProps extends Partial<PetCareDockProps> {
  isSleeping: boolean;
  isSick: boolean;
}

/**
 * ActionButtons adapter component for Pet Society care dock.
 * Maintains full backwards compatibility with previous interface while
 * routing directly to the new PetCareDock toolbar.
 */
export function ActionButtons(props: ActionButtonsProps) {
  return <PetCareDock {...props} />;
}

export { PetCareDock };
export type { PetCareDockProps };
