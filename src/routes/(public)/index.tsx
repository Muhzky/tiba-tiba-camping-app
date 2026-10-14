import { createFileRoute } from '@tanstack/react-router'
import { Hero } from '#/components/site/Hero'
import { Intro } from '#/components/site/Intro'
import { FeatureCards } from '#/components/site/FeatureCards'
import { Collections } from '#/components/site/Collections'
import { BestSellers } from '#/components/site/BestSellers'
import { BrandBand } from '#/components/site/BrandBand'
import { Recommendations } from '#/components/site/Recommendations'
import { Newsletter } from '#/components/site/Newsletter'

export const Route = createFileRoute('/(public)/')({
  component: Home,
})

function Home() {
  return (
    <>
      <Hero />
      <Intro />
      <FeatureCards />
      <Collections />
      <BestSellers />
      <BrandBand />
      <Recommendations />
      <Newsletter />
    </>
  )
}
