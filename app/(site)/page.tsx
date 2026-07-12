import { Hero } from "@/components/sections/hero";
import { TrustedBy } from "@/components/sections/trusted-by";
import { About } from "@/components/sections/about";
import { Services } from "@/components/sections/services";
import { Process } from "@/components/sections/process";
import { Technologies } from "@/components/sections/technologies";
import { Portfolio } from "@/components/sections/portfolio";
import { WhyChoose } from "@/components/sections/why-choose";
import { Testimonials } from "@/components/sections/testimonials";
import { Team } from "@/components/sections/team";
import { Pricing } from "@/components/sections/pricing";
import { Faq } from "@/components/sections/faq";
import { Contact } from "@/components/sections/contact";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <About />
      <Services />
      <Process />
      <Technologies />
      <Portfolio />
      <WhyChoose />
      <Testimonials />
      <Team />
      <Pricing />
      <Faq />
      <Contact />
    </>
  );
}
