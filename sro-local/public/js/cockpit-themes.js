var COCKPIT_THEMES = {
    bluesteel: {
        name: 'Blue Steel', type: 'solid',
        pageBg: '#1e3456', gridBg: '#152a48',
        cardGold: '#e8a832', cardYellow: '#c8a832', cardTeal: '#1a5c5a', centerBg: '#2a3a55',
        accent: '#2878b8', accentLight: '#40b8d8',
        textOnGold: '#1a2a44', textOnTeal: '#ffffff', textCenter: '#ffffff',
        checkIcon: '#2878b8', ok: '#4caf50', alert: '#f44336', warning: '#ffab00', pending: 'rgba(255,255,255,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/cockpit_bg.png', gridImgBg: '/cockpit/grid_bluesteel_bg.png',
        polygons: {
            conservative: "36.88,13 22.81,23.54 35.94,37.35 41.88,28.69 36.72,13",
            preop: "56.56,6.67 55.63,23.3 44.06,22.37 42.81,7.14 56.25,6.44",
            surgery: "57.19,29.16 64.06,35.95 69.06,33.14 75.47,21.43 65.31,13.23 57.19,28.69",
            outcomes: "80.78,38.99 80.63,57.73 66.25,52.81 66.72,39.93 80.63,38.52",
            pt: "58.13,66.39 64.53,57.49 75.94,64.75 64.38,82.32 58.44,66.86",
            engagement: "55,69.67 58.44,84.89 40.78,83.72 45,69.2 55,69.67",
            comorbidities: "35.78,57.49 40.94,66.86 35,80.91 23.13,64.52 35.63,57.96",
            previoustreatment: "19.06,38.76 33.13,40.63 32.97,52.34 19.69,57.49 18.91,38.52",
            patient: "41.56,38.29 42.19,56.79 46.88,62.65 53.59,62.65 60.78,49.77 54.06,32.2 45.31,32.67 42.03,38.06"
        },
        centroids: {
            conservative:{x:34.5,y:24.9}, preop:{x:49.9,y:13.2}, surgery:{x:64.7,y:26.8},
            outcomes:{x:73.0,y:47.6}, pt:{x:64.1,y:69.4}, engagement:{x:49.8,y:76.9},
            comorbidities:{x:33.7,y:67.8}, previoustreatment:{x:26.0,y:47.5}, patient:{x:49.5,y:48.0}
        }
    },
    militarygreen: {
        name: 'Military Green', type: 'solid',
        pageBg: '#2a3a2a', gridBg: '#1a2a1a',
        cardGold: '#8a9a3a', cardYellow: '#7a8a2a', cardTeal: '#2a4a2a', centerBg: '#1a2a1a',
        accent: '#5a8a3a', accentLight: '#7aaa5a',
        textOnGold: '#1a2a1a', textOnTeal: '#d0e0c0', textCenter: '#d0e0c0',
        checkIcon: '#5a8a3a', ok: '#5a8a3a', alert: '#cc4444', warning: '#ccaa33', pending: 'rgba(208,224,192,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/militarygreen.png', gridImgBg: '/cockpit/themes/militarygreen_grid.png',
        polygons: {
            preop: "40.72,17.51 49.5,16.62 59.58,17.66 56.59,26.05 50.5,25.6 43.51,26.2 40.62,17.81",
            surgery: "59.88,28.14 62.77,31.44 64.97,35.18 77.64,29.19 72.06,21.26 64.07,14.67 59.78,27.84",
            outcomes: "65.87,39.82 66.47,44.16 66.17,49.25 80.14,55.09 81.14,46.56 80.54,41.02 79.34,34.28 65.97,39.52",
            pt: "65.57,53.59 79.04,59.28 76.55,66.47 72.46,72.31 68.76,75.9 64.17,79.34 59.58,61.98 63.37,58.53 65.67,52.99",
            engagement: "42.81,62.72 38.82,79.94 44.11,81.44 49.2,82.04 55.09,81.74 61.08,79.79 56.59,63.47 52.89,64.37 49.4,64.67 45.61,64.07 42.61,62.57",
            patient: "50,30.84 55.39,32.34 59.28,35.93 61.68,40.72 62.38,44.01 62.08,48.2 60.28,52.54 57.98,54.94 54.49,57.19 50.2,57.78 46.21,57.04 42.61,55.39 39.72,51.65 38.12,47.9 37.43,44.01 38.82,38.47 42.22,33.98 50.2,30.69",
            conservative: "40.12,28.29 37.33,31.44 35.13,34.88 23.05,29.34 26.65,22.9 30.64,18.71 35.53,14.52 40.02,28.44",
            previoustreatment: "20.86,34.58 34.03,40.12 33.63,44.46 33.63,49.25 20.26,55.84 19.26,48.8 19.36,42.81 20.96,34.28",
            comorbidities: "34.43,53.44 21.46,59.88 23.85,66.47 27.05,71.41 31.04,75.6 35.83,79.04 39.82,61.68 36.93,58.68 34.43,53.44"
        },
        centroids: {
            preop:{x:50.1,y:21.8}, surgery:{x:68.8,y:26.7}, outcomes:{x:73.1,y:46.5},
            pt:{x:69.3,y:65.8}, engagement:{x:49.8,y:72.0}, patient:{x:50.0,y:44.4},
            conservative:{x:33.0,y:25.8}, previoustreatment:{x:27.0,y:44.5}, comorbidities:{x:32.0,y:65.5}
        }
    },
    matrix: {
        name: 'Matrix', type: 'image',
        pageBg: '#0a0a0a', gridBg: 'rgba(0,20,0,0.75)',
        cardGold: 'rgba(0,40,0,0.85)', cardYellow: 'rgba(0,40,0,0.85)', cardTeal: 'rgba(0,30,0,0.85)', centerBg: 'rgba(0,15,0,0.9)',
        accent: '#00ff41', accentLight: '#33ff66',
        textOnGold: '#00ff41', textOnTeal: '#00ff41', textCenter: '#00ff41',
        checkIcon: '#00ff41', ok: '#00ff41', alert: '#ff3333', warning: '#ffaa00', pending: 'rgba(0,255,65,0.25)',
        titleFont: '"Courier New", monospace', bodyFont: '"Courier New", monospace',
        circleBg: '/cockpit/themes/Neonspacecockpit.png', gridImgBg: '/cockpit/themes/matrix_grid.png', bodyBgImage: '/cockpit/themes/matrix_scene.png',
        polygons: {
            preop: "43.11,17.66 56.59,17.96 55.69,23.95 51,23.5 46.61,23.95 44.21,24.55 43.11,17.22",
            patient: "49.8,30.24 55.19,31.29 59.78,34.88 62.67,39.52 63.37,45.51 62.18,50 59.38,53.29 55.49,56.29 51.5,57.19 47.8,57.19 44.21,55.84 40.52,53.89 37.82,49.85 36.83,45.81 36.93,40.42 38.92,35.63 42.61,32.34 46.41,30.84 49.8,30.39",
            surgery: "59.98,27.25 63.17,29.19 66.17,33.68 79.34,28.14 75.85,22.46 72.06,18.56 65.17,13.77",
            outcomes: "67.76,38.62 81.94,33.08 83.33,39.07 83.93,45.66 82.53,54.94 67.86,49.1 68.46,44.31 67.76,38.62",
            pt: "66.97,53.29 80.74,60.03 77.35,67.07 73.15,72.6 66.37,77.1 60.58,61.08 64.17,57.78 67.17,52.99",
            engagement: "56.79,63.32 60.48,79.64 54.09,81.44 47.8,81.14 42.42,80.84 39.62,79.64 42.81,63.92 45.71,65.27 48.7,65.87 51.4,65.87 53.99,64.97 56.59,63.17",
            previoustreatment: "33.03,52.84 18.96,59.28 20.46,64.37 22.65,68.26 25.85,72.31 29.54,74.85 32.93,76.95 35.83,71.41 39.02,60.78 36.03,58.53 33.03,52.99",
            conservative: "18.06,33.23 31.94,38.02 31.34,42.22 31.84,48.5 17.47,54.64 16.27,46.41 16.47,38.77",
            comorbidities: "20.96,27.54 33.43,32.93 36.23,29.19 39.92,27.1 37.82,19.76 35.73,13.77 30.74,16.62 26.55,20.66 21.26,27.25"
        },
        centroids: {
            preop:{x:49.8,y:20.8}, patient:{x:50.0,y:44.0}, surgery:{x:69.5,y:24.5},
            outcomes:{x:75.5,y:44.0}, pt:{x:70.5,y:63.5}, engagement:{x:50.0,y:72.0},
            previoustreatment:{x:30.0,y:65.0}, conservative:{x:24.0,y:44.0}, comorbidities:{x:31.5,y:24.5}
        }
    },
    chalkboard: {
        name: 'Chalk Board', type: 'solid',
        pageBg: '#e8e4dc', gridBg: '#d8d4cc',
        cardGold: '#d4880a', cardYellow: '#c8a832', cardTeal: '#2a6a5a', centerBg: '#3a3a3a',
        accent: '#2563eb', accentLight: '#3b82f6',
        textOnGold: '#2a1a0a', textOnTeal: '#ffffff', textCenter: '#ffffff',
        checkIcon: '#2563eb', ok: '#16a34a', alert: '#dc2626', warning: '#d97706', pending: 'rgba(0,0,0,0.25)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Chalkboard.png', gridImgBg: '/cockpit/themes/chalkboard_grid.png',
        polygons: {
            preop: "43.21,14.07 57.58,15.72 55.69,22.75 50.4,21.41 45.41,22.75 43.01,13.92",
            surgery: "64.17,15.27 59.98,25.45 62.38,28.74 64.27,32.63 74.35,25.45 64.77,14.82",
            outcomes: "66.17,37.87 79.14,35.33 80.14,41.92 79.74,51.05 66.47,45.81",
            pt: "65.17,50.3 77.35,55.39 74.95,62.57 71.36,68.11 66.47,72.75 60.68,56.74 64.97,50.6",
            patient: "50.5,29.34 54.19,29.94 57.58,32.19 60.48,36.08 61.98,40.87 61.38,46.11 57.98,51.05 53.89,53.29 50.3,54.04 46.41,52.54 42.61,49.55 40.22,44.46 40.02,38.02 43.11,32.63 46.71,29.94 50.6,29.64",
            conservative: "36.83,14.97 42.12,26.2 38.82,28.89 36.43,33.08 27.64,25.9 32.24,19.61",
            comorbidities: "21.06,35.78 35.03,37.72 34.23,41.92 34.83,45.36 21.06,51.05 20.46,46.11 20.26,41.02 21.06,36.23",
            previoustreatment: "35.43,50.6 23.55,55.54 24.65,61.38 27.94,66.62 31.04,70.21 34.43,72.9 39.62,57.63 37.43,54.19 35.83,50.45",
            engagement: "43.71,60.63 40.22,74.1 44.91,76.05 49.5,76.95 55.59,75.75 60.28,74.25 56.49,60.78 52.59,61.98 48.6,61.98 44.01,60.33"
        },
        centroids: {
            preop:{x:50.3,y:18.0}, surgery:{x:66.5,y:23.5}, outcomes:{x:73.0,y:43.0},
            pt:{x:70.0,y:61.0}, patient:{x:50.5,y:41.5}, conservative:{x:35.5,y:24.5},
            comorbidities:{x:27.0,y:43.0}, previoustreatment:{x:32.5,y:61.5}, engagement:{x:50.0,y:68.0}
        }
    },
    beach: {
        name: 'Beach', type: 'image',
        pageBg: '#1a8a9a', gridBg: 'rgba(20,100,120,0.8)',
        cardGold: 'rgba(210,170,80,0.9)', cardYellow: 'rgba(210,180,100,0.9)', cardTeal: 'rgba(20,80,90,0.9)', centerBg: 'rgba(30,60,70,0.92)',
        accent: '#20b2aa', accentLight: '#40d8d0',
        textOnGold: '#1a2a2a', textOnTeal: '#ffffff', textCenter: '#ffffff',
        checkIcon: '#20b2aa', ok: '#20b2aa', alert: '#e85050', warning: '#e0c060', pending: 'rgba(255,255,255,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Beach.png', gridImgBg: '/cockpit/themes/beach_grid.png', bodyBgImage: '/cockpit/themes/beach_scene.png',
        polygons: {
            preop: "40.82,18.56 49.8,17.22 58.78,18.56 56.29,26.05 48.2,25.15 43.31,26.2 40.92,18.26",
            surgery: "59.18,28.74 63.87,14.97 70.16,20.36 74.05,24.4 76.95,29.04 64.97,35.48 62.48,31.14 59.38,28.44",
            outcomes: "65.47,38.92 66.37,44.46 66.07,49.25 80.04,55.84 80.84,49.4 80.54,42.22 79.04,33.68 65.97,38.77",
            pt: "65.57,53.59 78.74,59.73 73.55,70.66 69.66,74.25 64.47,79.04 60.18,61.38 63.37,57.93 65.57,53.89",
            engagement: "43.31,63.77 47.9,65.27 52,65.57 56.39,63.92 60.78,80.24 54.99,81.74 50.1,82.63 44.41,81.44 39.22,80.09 43.31,63.92",
            comorbidities: "34.13,53.14 36.43,58.08 39.82,61.38 35.93,78.74 29.14,73.95 25.15,67.96 21.46,60.03 33.83,53.14",
            previoustreatment: "21.26,33.83 34.23,39.52 33.43,44.91 34.03,49.7 20.16,56.29 19.26,48.2 19.66,41.02 21.46,33.83",
            conservative: "23.25,28.89 34.83,35.93 37.33,31.29 40.62,29.04 35.73,15.27 31.44,18.41 27.05,23.35 23.45,29.34",
            patient: "50,31.14 54.49,32.34 58.68,35.03 61.38,39.97 62.28,44.61 61.38,49.7 58.78,54.04 54.59,56.89 50.1,57.63 45.51,57.04 41.42,54.04 38.22,48.95 38.02,41.47 41.42,34.73 45.61,32.04 50.2,30.99"
        },
        centroids: {
            preop:{x:49.8,y:21.6}, surgery:{x:67.9,y:26.7}, outcomes:{x:73.0,y:44.8},
            pt:{x:69.0,y:66.0}, engagement:{x:50.0,y:72.5}, comorbidities:{x:31.5,y:64.8},
            previoustreatment:{x:27.0,y:44.0}, conservative:{x:32.5,y:26.0}, patient:{x:50.0,y:44.5}
        }
    },
    space: {
        name: 'Space', type: 'image',
        pageBg: '#0a0a1a', gridBg: 'rgba(10,10,30,0.75)',
        cardGold: 'rgba(160,120,40,0.88)', cardYellow: 'rgba(140,110,40,0.88)', cardTeal: 'rgba(20,50,50,0.88)', centerBg: 'rgba(10,10,25,0.92)',
        accent: '#d4a04a', accentLight: '#e8b85a',
        textOnGold: '#1a1a2e', textOnTeal: '#ffffff', textCenter: '#ffffff',
        checkIcon: '#d4a04a', ok: '#4caf50', alert: '#f44336', warning: '#d4a04a', pending: 'rgba(255,255,255,0.25)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/space.png', gridImgBg: '/cockpit/themes/space_grid.png', bodyBgImage: '/cockpit/themes/space_scene.png',
        polygons: {
            preop: "41.12,19.31 46.61,17.66 51,17.51 54.79,17.66 58.48,18.71 56.69,26.35 53.39,25.3 49.1,24.85 43.21,26.35 41.12,19.46",
            surgery: "63.77,15.57 68.16,18.41 72.75,22.6 76.55,29.04 64.77,35.18 62.38,31.44 59.48,28.44 63.77,15.87",
            outcomes: "65.37,38.77 78.84,34.73 80.74,44.01 80.64,50.75 80.34,54.64 66.37,49.25 66.57,44.31 65.67,39.07",
            pt: "65.57,53.89 78.74,59.43 76.35,65.87 73.05,70.96 68.96,75.75 63.97,79.04 60.08,61.98 63.17,59.13 65.57,54.19",
            engagement: "43.01,62.57 39.02,80.39 44.61,82.34 50,82.63 56.09,81.89 60.68,80.54 56.89,62.72 52.59,65.12 47.8,64.22 42.81,62.57",
            comorbidities: "34.23,53.74 36.53,57.78 39.82,61.68 35.93,78.89 30.84,75.6 26.25,70.36 21.46,59.58 34.23,53.89",
            previoustreatment: "20.86,34.88 34.43,39.22 33.23,44.46 33.93,49.7 20.26,55.84 19.26,48.2 19.86,40.42 20.86,34.73",
            conservative: "23.45,29.49 35.13,35.33 37.92,31.29 40.42,29.49 36.23,16.32 31.94,18.56 27.74,23.65 23.65,29.34",
            patient: "49.9,31.59 55.29,32.49 58.68,34.58 60.98,38.77 62.38,44.61 61.18,50.6 56.49,56.29 50.7,58.08 44.01,56.29 39.42,51.2 37.52,45.51 39.12,39.37 41.82,34.43 45.61,32.78 49.8,31.59"
        },
        centroids: {
            preop:{x:50.0,y:22.0}, surgery:{x:67.5,y:25.5}, outcomes:{x:73.0,y:44.8},
            pt:{x:69.0,y:66.0}, engagement:{x:50.0,y:72.0}, comorbidities:{x:32.0,y:66.0},
            previoustreatment:{x:27.0,y:44.5}, conservative:{x:32.5,y:26.5}, patient:{x:50.0,y:44.5}
        }
    },
    razorback: {
        name: 'Razorback', type: 'image',
        pageBg: '#1a2a1a', gridBg: 'rgba(20,30,20,0.8)',
        cardGold: 'rgba(50,60,50,0.9)', cardYellow: 'rgba(50,60,50,0.9)', cardTeal: 'rgba(30,45,30,0.9)', centerBg: 'rgba(15,25,30,0.92)',
        accent: '#c8a832', accentLight: '#d8b842',
        textOnGold: '#e0d8c0', textOnTeal: '#e0d8c0', textCenter: '#ffffff',
        checkIcon: '#5a9a3a', ok: '#5a9a3a', alert: '#cc3333', warning: '#ccaa22', pending: 'rgba(224,216,192,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Razorback.png', gridImgBg: '/cockpit/themes/razorback_grid.png', bodyBgImage: '/cockpit/themes/razorback_scene.png',
        polygons: {
            preop: "41.02,18.41 49.2,16.32 54.79,17.37 58.98,18.56 56.59,26.65 52.99,25.15 48.2,24.85 43.11,26.35 41.02,19.01",
            patient: "49.6,30.84 55.59,32.93 58.78,35.93 61.48,40.72 62.28,44.91 61.38,49.4 59.58,52.99 56.29,55.99 52.79,57.49 49,57.63 45.51,57.04 41.62,54.19 39.02,50.6 37.62,46.56 38.02,42.22 39.82,37.13 42.81,34.73 49.3,30.84",
            surgery: "59.18,29.04 61.88,31.14 63.67,33.38 64.87,35.93 77.05,28.59 72.55,21.71 68.46,17.66 64.87,14.97 59.38,29.04",
            outcomes: "65.77,39.22 66.87,44.16 66.17,49.4 80.14,55.39 81.04,48.2 80.64,42.51 78.74,34.13 66.17,39.22",
            pt: "65.47,53.14 79.24,59.28 75.95,67.37 71.96,72.46 63.87,79.34 59.88,61.38 63.77,57.63 65.47,53.29",
            engagement: "43.01,62.43 39.12,80.24 45.61,82.34 52.79,82.34 60.98,80.24 56.89,62.57 52.1,64.37 48.2,64.52 43.21,62.57",
            comorbidities: "34.23,53.29 20.66,58.98 23.15,65.57 26.05,70.36 30.44,75 35.63,79.04 39.82,61.38 37.03,58.08 34.23,53.29",
            previoustreatment: "20.66,35.33 33.83,39.82 33.33,44.61 33.83,49.7 19.76,55.69 18.96,48.5 19.16,42.07 20.86,35.78",
            conservative: "23.25,27.69 34.63,35.48 37.52,31.44 40.62,29.04 35.23,15.42 29.14,19.91 23.35,27.4"
        },
        centroids: {
            preop:{x:50.0,y:21.5}, patient:{x:50.0,y:44.5}, surgery:{x:67.5,y:26.0},
            outcomes:{x:73.0,y:45.0}, pt:{x:69.0,y:65.0}, engagement:{x:50.0,y:72.0},
            comorbidities:{x:32.0,y:65.5}, previoustreatment:{x:27.0,y:44.5}, conservative:{x:32.5,y:26.5}
        }
    },
    ranch: {
        name: 'Ranch', type: 'image',
        pageBg: '#2a1a0a', gridBg: 'rgba(40,25,10,0.8)',
        cardGold: 'rgba(80,55,25,0.9)', cardYellow: 'rgba(80,55,25,0.9)', cardTeal: 'rgba(40,35,20,0.9)', centerBg: 'rgba(25,20,15,0.92)',
        accent: '#c8962a', accentLight: '#d8a63a',
        textOnGold: '#f0e8d0', textOnTeal: '#f0e8d0', textCenter: '#ffffff',
        checkIcon: '#c8962a', ok: '#6a9a3a', alert: '#cc4444', warning: '#c8962a', pending: 'rgba(240,232,208,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Ranch.png', gridImgBg: '/cockpit/themes/ranch_grid.png', bodyBgImage: '/cockpit/themes/ranch_scene.png',
        polygons: {
            preop: "49.2,16.77 57.98,18.56 56.09,26.05 51.6,25 47.41,25.15 43.21,26.2 41.02,18.11 49.1,17.22",
            surgery: "59.98,29.34 64.37,16.17 68.86,20.06 72.26,23.65 75.75,30.54 68.76,33.83 65.17,35.03 62.87,32.04 60.18,28.59",
            outcomes: "65.87,39.82 66.37,45.21 66.17,48.95 79.54,53.59 79.64,41.47 78.44,35.63 66.47,39.82",
            pt: "65.67,54.04 78.54,58.08 76.45,64.97 74.35,69.31 70.06,74.85 64.07,78.44 60.18,61.83 62.87,58.98 65.57,53.89",
            patient: "49.5,31.14 54.59,32.04 58.78,35.33 60.98,39.22 62.48,45.21 61.48,50 59.38,54.19 55.89,56.59 52,58.23 47.8,58.08 43.21,56.29 39.62,52.1 37.33,46.56 38.32,40.27 40.82,35.93 43.91,32.63 49.3,31.14",
            conservative: "39.62,28.74 34.93,34.88 23.45,30.39 28.14,22.46 34.93,15.42 39.52,28.44",
            comorbidities: "21.46,36.68 34.23,39.52 33.63,45.51 34.13,50 20.56,54.19 20.06,46.26 21.26,37.13",
            previoustreatment: "34.23,53.74 21.66,58.38 23.95,65.27 26.25,69.76 29.24,73.95 36.03,79.19 39.72,61.98 36.83,59.13 34.23,54.04",
            engagement: "43.61,64.37 47.8,64.97 52,64.82 55.99,64.22 59.18,80.09 52.5,82.19 47.11,82.04 41.42,79.94 43.51,64.67"
        },
        centroids: {
            preop:{x:50.0,y:21.5}, surgery:{x:67.5,y:26.5}, outcomes:{x:72.5,y:44.5},
            pt:{x:69.5,y:65.0}, patient:{x:50.0,y:44.5}, conservative:{x:33.0,y:26.5},
            comorbidities:{x:27.0,y:44.5}, previoustreatment:{x:32.0,y:65.5}, engagement:{x:50.0,y:72.5}
        }
    },
    ocean: {
        name: 'Ocean', type: 'image',
        pageBg: '#0a2a3a', gridBg: 'rgba(10,35,50,0.8)',
        cardGold: 'rgba(30,60,70,0.9)', cardYellow: 'rgba(30,60,70,0.9)', cardTeal: 'rgba(15,50,60,0.9)', centerBg: 'rgba(10,30,45,0.92)',
        accent: '#40b8d8', accentLight: '#60d0e8',
        textOnGold: '#d0f0ff', textOnTeal: '#d0f0ff', textCenter: '#ffffff',
        checkIcon: '#40b8d8', ok: '#40b8a0', alert: '#e06060', warning: '#e0c060', pending: 'rgba(208,240,255,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Ocean.png', gridImgBg: '/cockpit/themes/ocean_grid.png', bodyBgImage: '/cockpit/themes/ocean_scene.png',
        polygons: {
            preop: "40.22,18.26 49.2,16.47 59.18,18.56 56.59,27.54 50.3,26.2 43.61,27.84 40.22,17.96",
            patient: "50,31.44 56.99,34.13 61.18,39.97 61.88,48.95 57.58,55.69 50.2,58.08 43.51,55.84 39.42,50.6 37.92,45.21 40.82,37.28 45.41,32.78 49.7,31.14",
            surgery: "59.08,28.74 63.97,13.32 68.46,17.96 72.85,22.6 76.75,29.94 65.07,36.83 61.98,32.34 58.98,28.89",
            outcomes: "65.77,40.12 78.04,33.53 79.64,39.82 80.44,45.66 80.34,51.5 79.34,55.84 66.17,50.15 66.67,44.91 65.87,40.42",
            pt: "58.88,61.83 62.87,58.68 65.17,53.59 78.74,59.58 75.65,68.26 72.16,73.65 67.96,77.54 63.37,80.24 59.08,61.68",
            engagement: "43.21,62.87 39.12,80.24 45.01,82.93 54.09,82.78 60.38,80.54 56.39,62.87 52.4,64.37 48,64.52 43.51,62.87",
            comorbidities: "35.03,53.74 21.66,61.68 24.05,66.77 30.04,74.55 36.43,79.49 41.12,61.68 37.43,58.23 35.03,53.89",
            previoustreatment: "22.55,31.29 28.04,36.83 34.53,40.42 33.63,45.06 34.43,50.9 20.96,58.53 19.66,49.4 20.26,39.52 22.65,31.14",
            conservative: "24.05,28.74 28.44,20.81 35.23,14.07 41.02,29.04 37.82,32.49 35.43,36.98 24.05,28.74"
        },
        centroids: {
            preop:{x:49.7,y:22.0}, patient:{x:50.0,y:44.8}, surgery:{x:67.9,y:26.4},
            outcomes:{x:73.0,y:45.8}, pt:{x:68.0,y:67.4}, engagement:{x:49.8,y:71.6},
            comorbidities:{x:32.5,y:65.8}, previoustreatment:{x:27.6,y:44.0}, conservative:{x:32.7,y:25.4}
        }
    },
    winter: {
        name: 'Winter', type: 'image',
        pageBg: '#1a2a3a', gridBg: 'rgba(20,35,50,0.8)',
        cardGold: 'rgba(50,70,60,0.9)', cardYellow: 'rgba(50,70,60,0.9)', cardTeal: 'rgba(30,50,45,0.9)', centerBg: 'rgba(15,30,40,0.92)',
        accent: '#7aaa8a', accentLight: '#9acaaa',
        textOnGold: '#d0e8d8', textOnTeal: '#d0e8d8', textCenter: '#ffffff',
        checkIcon: '#7aaa8a', ok: '#7aaa8a', alert: '#cc4444', warning: '#ccaa33', pending: 'rgba(208,232,216,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Winter.png', gridImgBg: '/cockpit/themes/winter_grid.png', bodyBgImage: '/cockpit/themes/Winter.png',
        polygons: {
            preop: "41.22,18.26 48.9,17.37 58.18,18.26 56.19,26.2 49.9,25.15 43.41,26.5 41.32,18.26",
            conservative: "35.53,15.42 40.02,28.74 36.73,31.89 35.13,35.78 23.25,29.19 28.54,20.96",
            surgery: "63.77,14.97 59.78,28.74 62.38,31.59 64.97,36.08 76.75,29.34 72.95,23.05 68.56,18.26 64.37,14.97",
            outcomes: "65.97,39.82 79.04,34.13 80.54,39.67 80.84,47.01 80.04,55.69 66.17,50 66.67,44.91 65.87,40.12",
            pt: "65.47,53.44 79.34,59.28 77.15,64.67 73.45,70.96 69.76,74.7 63.97,79.04 59.88,61.98 63.37,58.08 65.57,53.14",
            engagement: "56.59,63.47 60.78,79.79 56.39,80.99 51.4,81.89 45.91,81.74 39.42,79.64 42.81,63.77 45.71,64.82 49.3,65.42 53.09,64.82 56.39,63.17",
            comorbidities: "34.33,53.74 20.86,59.28 23.55,64.97 27.45,71.56 31.64,76.35 35.73,79.04 39.82,61.68 36.73,58.38 34.13,53.89",
            patient: "49.2,31.14 53.19,31.44 56.39,33.53 59.18,36.23 61.28,40.12 62.18,44.01 61.48,49.85 59.58,53.29 56.99,56.14 52.3,57.78 49,58.08 45.61,57.19 42.91,55.24 40.12,52.99 39.22,50 38.02,47.01 37.43,42.51 39.42,38.02 42.71,34.13 45.51,32.19 49.2,30.69",
            previoustreatment: "33.73,40.12 20.86,34.43 19.46,39.97 19.06,48.65 19.86,55.39 33.83,49.55 33.23,46.26"
        },
        centroids: {
            preop:{x:49.7,y:21.8}, conservative:{x:33.0,y:25.5}, surgery:{x:68.0,y:25.5},
            outcomes:{x:73.0,y:45.0}, pt:{x:69.0,y:65.5}, engagement:{x:50.0,y:72.0},
            comorbidities:{x:32.0,y:66.0}, patient:{x:50.0,y:44.5}, previoustreatment:{x:27.0,y:44.5}
        }
    },
    library: {
        name: 'Library', type: 'image',
        pageBg: '#1a1410', gridBg: 'rgba(42,31,20,0.8)',
        cardGold: 'rgba(80,60,30,0.9)', cardYellow: 'rgba(80,60,30,0.9)', cardTeal: 'rgba(40,35,20,0.9)', centerBg: 'rgba(25,20,15,0.92)',
        accent: '#d4a04a', accentLight: '#e8b85a',
        textOnGold: '#f5e6c8', textOnTeal: '#f5e6c8', textCenter: '#ffffff',
        checkIcon: '#d4a04a', ok: '#5a9e3e', alert: '#ff4444', warning: '#d4a04a', pending: 'rgba(245,230,200,0.3)',
        titleFont: 'Orbitron, monospace', bodyFont: 'Rajdhani, sans-serif',
        circleBg: '/cockpit/themes/Library.png', gridImgBg: '/cockpit/themes/library_grid.png', bodyBgImage: '/cockpit/themes/Library.png',
        polygons: {
            comorbidities: "17.76,24.55 31.34,30.84 38.02,25.15 34.83,13.77 17.86,24.55",
            conservative: "14.27,33.53 13.07,49.7 29.34,46.11 29.84,38.02 14.47,32.93",
            previoustreatment: "16.87,58.53 30.64,52.84 36.43,59.73 31.84,73.05 17.17,58.98",
            surgery: "61.58,25.3 65.97,13.47 82.04,25.45 68.56,30.69 61.78,25.45",
            outcomes: "70.16,38.02 86.13,33.98 87.13,49.7 70.56,46.41 70.36,37.87",
            patient: "37.62,36.83 49,30.54 62.77,37.87 63.97,46.71 55.59,55.09 46.01,55.24 36.83,47.9 37.62,37.13",
            pt: "63.37,60.18 67.96,73.05 76.65,67.96 84.13,58.53 69.56,52.1 63.27,60.33",
            engagement: "41.82,63.17 49.3,64.22 58.08,63.02 60.78,75.45 50.4,77.54 39.72,75.15 41.72,62.57",
            preop: "43.31,23.65 50,22.46 56.89,24.85 59.08,13.47 41.82,13.77 43.41,23.5"
        },
        centroids: {
            comorbidities:{x:28.0,y:23.8}, conservative:{x:21.5,y:41.3}, previoustreatment:{x:26.4,y:63.0},
            surgery:{x:71.8,y:23.8}, outcomes:{x:78.5,y:41.5}, patient:{x:50.0,y:44.5},
            pt:{x:73.1,y:63.5}, engagement:{x:50.3,y:69.4}, preop:{x:50.2,y:18.5}
        }
    }
};

var COCKPIT_THEME_ORDER = ['bluesteel','militarygreen','matrix','chalkboard','beach','space','razorback','ranch','ocean','winter','library'];

function getCockpitTheme() { return localStorage.getItem('sro-cockpit-theme') || 'bluesteel'; }
function setCockpitTheme(key) { localStorage.setItem('sro-cockpit-theme', key); }
function getCockpitLayout() { return localStorage.getItem('sro-cockpit-layout') || 'circle'; }
function setCockpitLayout(key) { localStorage.setItem('sro-cockpit-layout', key); }

function cockpitUrl(layout, patientId, returnTo, date) {
    var pages = { circle: '/cockpit-view.html', grid: '/cockpit-grid.html', gridimg: '/cockpit-grid-img.html' };
    var url = pages[layout] + '?patient=' + patientId;
    if (returnTo) url += '&returnTo=' + returnTo;
    if (date) url += '&date=' + date;
    return url;
}
