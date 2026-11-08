// The shapes shared by the experience and education data and by the components that render them.

export type Bullet = string | { text: string; linkText: string; url: string };

export interface TimelineLink {
  label: string;
  url: string;
  /** GitHub stars, shown as a small star and count (for example "800+"). */
  stars?: string;
}

export interface TimelineItem {
  title: string;
  titleShort?: string;
  badge?: string;
  subtitle: string;
  subtitleShort?: string;
  subtitleUrl?: string;
  description?: string;
  dates: string;
  datesShort?: string;
  location: string;
  locationShort?: string;
  logo?: string;
  logoDark?: string;
  rounded?: boolean;
  bullets?: Bullet[];
  /** Project links shown under the description, optionally with a GitHub star count. */
  links?: TimelineLink[];
  /** Shown under the bullets, for example "Via Rent Your Student Scrum Team (RYSST)" for roles that went through an agency. */
  via?: TimelineLink;
  /** Left off the resume: glows when the section is opened through its anchor link. */
  earlier?: boolean;
}
