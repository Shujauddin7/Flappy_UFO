"use client";

import React, { memo } from 'react';
import PlanetImage from '@/components/PlanetImage';

interface PlanetProps {
    name: string;
    image: string;
    size: number;
    priority?: boolean;
    onLoad?: () => void;
    onError?: () => void;
}

const Planet = memo(({
    name,
    image,
    size,
    priority = false,
    onLoad,
    onError
}: PlanetProps) => {
    return (
        <PlanetImage
            name={name}
            src={image}
            size={size}
            priority={priority}
            onLoad={onLoad}
            onError={onError}
            className="planet-wrapper"
        />
    );
});

Planet.displayName = 'Planet';

export default Planet;
