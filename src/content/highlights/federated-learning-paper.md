---
title: Published paper at IEEE Big Data 2025
track: research
when: "December 2025"
stat: "My first conference presentation"
summary: "Wrote a paper on federated learning with Dr. Ana Oprescu as part of my master's thesis at the University of Amsterdam, and presented it in Macao."
order: 4
date: 2025-12-08
thumbnail: /media/ieee/presenting.webp
cardImage: /media/ieee/card.webp
thumbnailAlt: Presenting the paper on stage in Macao, with its title on the screen behind me
thumbnailFull: /media/ieee/full/presenting.webp
photoGrid:
  - src: /media/ieee/cable-car.webp
    full: /media/ieee/full/cable-car.webp
    alt: My brother and me in a cable car above water and green hills
  - src: /media/ieee/night-market.webp
    full: /media/ieee/full/night-market.webp
    alt: A busy night market with rows of red lanterns overhead
  - src: /media/ieee/hong-kong-night.webp
    full: /media/ieee/full/hong-kong-night.webp
    alt: The Hong Kong skyline and harbour at night
  - src: /media/ieee/temple.webp
    full: /media/ieee/full/temple.webp
    alt: A traditional Chinese temple complex with bonsai trees in the foreground
  - src: /media/ieee/buddha.webp
    full: /media/ieee/full/buddha.webp
    position: 50% 22%
    alt: A giant seated Buddha statue on a hill, with burning incense sticks in front
  - src: /media/ieee/buddha-hall.webp
    full: /media/ieee/full/buddha-hall.webp
    alt: A temple hall with five golden Buddha statues under an ornate ceiling
  - src: /media/ieee/ridge-trail.webp
    full: /media/ieee/full/ridge-trail.webp
    alt: A hiker on a stone path along a ridge above the sea
  - src: /media/ieee/sunset.webp
    full: /media/ieee/full/sunset.webp
    alt: The sun setting behind a large tree next to a stone building with a reflecting pool
links:
  - label: Paper (IEEE)
    url: https://doi.org/10.1109/BigData66926.2025.11401516
  - label: Paper (arXiv)
    url: https://arxiv.org/abs/2604.23386
  - label: Master's thesis
    url: https://github.com/DaanRosendal/fl-disagreement-resolution/blob/main/docs/FL_Disagreement_Resolution_Thesis_DaanRosendal.pdf
  - label: Code
    url: https://github.com/DaanRosendal/fl-disagreement-resolution
---

Federated learning lets many parties, called clients, train machine learning models together, and it normally assumes that every client works with every other client. In practice, clients may need to exclude each other for strategic, regulatory or competitive reasons.

In "A Taxonomy and Resolution Strategy for Client-Level Disagreements in Federated Learning", written with <a href="https://scholar.google.com/citations?user=cWSfzoUAAAAJ&hl=en" target="_blank" rel="noopener noreferrer">Dr. Ana Oprescu</a> as part of my master's thesis at the University of Amsterdam, I classify these disagreements and propose a multi-track approach that keeps isolated model update paths, so clients that exclude each other never affect each other's models. We tested it with an open-source simulation system on <a href="https://en.wikipedia.org/wiki/MNIST_database" target="_blank" rel="noopener noreferrer">MNIST</a> and <a href="https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/" target="_blank" rel="noopener noreferrer">N-CMAPSS</a> across 34 scenarios. On the server, resolving disagreements took under 1 ms per round in simulation.

I presented it at the 2025 IEEE International Conference on Big Data in Macao. It was my first time outside Europe, so I made the most of it and took my brother with me. I was nervous to present, but in the end it all went fine. Then we spent the rest of the trip in Shenzhen and Hong Kong, and seeing a completely different culture was so cool. It made me want to visit a lot more countries outside Europe!
