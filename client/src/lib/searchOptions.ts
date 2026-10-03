export interface SearchOptions {
    maxTransfers: number;
    maxWalkingDistance: number;
}

export const DEFAULT_OPTIONS: SearchOptions = { maxTransfers: 2, maxWalkingDistance: 800 };

export const TRANSFER_CHOICES = [0, 1, 2, 3, 4];
export const WALKING_CHOICES = [400, 800, 1200];
