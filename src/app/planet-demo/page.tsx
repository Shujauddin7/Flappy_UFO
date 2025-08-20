import React from 'react';
import Planet from '@/components/Planet';

export default function PlanetDemo() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-black p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold text-white text-center mb-12">
                    Planet Component Demo
                </h1>

                {/* Solar System Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 items-center justify-items-center">

                    {/* Earth - Medium size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Earth" image="/Earth.jpg" size={120} />
                        <p className="text-blue-300 font-semibold">Earth</p>
                    </div>

                    {/* Mars - Small size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Mars" image="/Mercury.jpg" size={100} />
                        <p className="text-red-300 font-semibold">Mars (using Mercury texture)</p>
                    </div>

                    {/* Jupiter - Large size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Jupiter" image="/Jupiter.jpg" size={140} />
                        <p className="text-orange-300 font-semibold">Jupiter</p>
                    </div>

                    {/* Saturn - Large with ring */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Saturn" image="/Saturn.jpg" size={130} />
                        <p className="text-yellow-300 font-semibold">Saturn</p>
                    </div>

                    {/* Venus - Medium size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Venus" image="/Venus.jpg" size={110} />
                        <p className="text-yellow-200 font-semibold">Venus</p>
                    </div>

                    {/* Neptune - Medium size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Neptune" image="/Neptune.jpg" size={115} />
                        <p className="text-blue-400 font-semibold">Neptune</p>
                    </div>

                    {/* Uranus - Medium size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Uranus" image="/Uranus.jpg" size={108} />
                        <p className="text-cyan-300 font-semibold">Uranus</p>
                    </div>

                    {/* Mercury - Small size */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Mercury" image="/Mercury.jpg" size={90} />
                        <p className="text-gray-300 font-semibold">Mercury</p>
                    </div>

                    {/* Custom planet example */}
                    <div className="flex flex-col items-center space-y-4">
                        <Planet name="Custom" image="/OSIRIS.jpg" size={95} />
                        <p className="text-white font-semibold">Custom Planet</p>
                    </div>

                </div>

                {/* Usage Examples */}
                <div className="mt-16 bg-gray-900 rounded-lg p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Usage Examples</h2>
                    <div className="bg-gray-800 rounded p-4 font-mono text-sm text-green-400">
                        <div className="text-gray-400">// Basic usage</div>
                        <div>&lt;Planet name="Earth" image="/Earth.jpg" size={'{120}'} /&gt;</div>
                        <br />
                        <div className="text-gray-400">// Different sizes</div>
                        <div>&lt;Planet name="Jupiter" image="/Jupiter.jpg" size={'{140}'} /&gt;</div>
                        <div>&lt;Planet name="Mercury" image="/Mercury.jpg" size={'{90}'} /&gt;</div>
                        <br />
                        <div className="text-gray-400">// Custom planet with default glow</div>
                        <div>&lt;Planet name="Kepler" image="/custom-planet.jpg" size={'{110}'} /&gt;</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
