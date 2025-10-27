// Centralized mock data for all user types
export const mockData = {
  // Members
  members: [
    {
      id: 1,
      name: 'Priya Sharma',
      age: 24,
      city: 'Mumbai',
      pronouns: 'she/her',
      bio: 'Passionate about technology and innovation. Love meeting new people and exploring new ideas.',
      interests: ['Technology', 'Innovation', 'Networking', 'Travel'],
      username: 'priya_tech',
      follower_count: 1250,
      following_count: 890,
      post_count: 45,
      profile_photo_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
      photos: [
        { id: 1, photo_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400', photo_order: 0 },
        { id: 2, photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400', photo_order: 1 },
        { id: 3, photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', photo_order: 2 }
      ]
    },
    {
      id: 2,
      name: 'Arjun Patel',
      age: 26,
      city: 'Bangalore',
      pronouns: 'he/him',
      bio: 'Entrepreneur and startup enthusiast. Always looking for the next big idea and amazing people to work with.',
      interests: ['Entrepreneurship', 'Startups', 'Business', 'Fitness'],
      username: 'arjun_startup',
      follower_count: 2100,
      following_count: 1200,
      post_count: 78,
      profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      photos: [
        { id: 4, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', photo_order: 0 },
        { id: 5, photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', photo_order: 1 }
      ]
    }
  ],

  // Communities
  communities: [
    {
      id: 1,
      name: 'Tech Mumbai',
      bio: 'Connecting tech enthusiasts in Mumbai. We organize meetups, hackathons, and networking events.',
      category: 'Technology',
      location: 'Mumbai, India',
      email: 'contact@techmumbai.com',
      phone: '9876543210',
      sponsor_types: ['Technology', 'Education', 'Startups'],
      username: 'tech_mumbai',
      logo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      follower_count: 5200,
      following_count: 1200,
      post_count: 156,
      created_at: '2023-01-15T10:00:00Z'
    },
    {
      id: 2,
      name: 'Startup India',
      bio: 'Empowering entrepreneurs across India. Building the next generation of startups.',
      category: 'Entrepreneurship',
      location: 'Bangalore, India',
      email: 'hello@startupindia.org',
      phone: '9876543211',
      sponsor_types: ['Finance', 'Technology', 'Marketing'],
      username: 'startup_india',
      logo_url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400',
      follower_count: 8900,
      following_count: 2100,
      post_count: 234,
      created_at: '2022-08-20T10:00:00Z'
    },
    {
      id: 3,
      name: 'Design Delhi',
      bio: 'Creative minds coming together. UI/UX designers, artists, and creative professionals.',
      category: 'Design',
      location: 'Delhi, India',
      email: 'info@designdelhi.com',
      phone: '9876543212',
      sponsor_types: ['Design', 'Art', 'Creative'],
      username: 'design_delhi',
      logo_url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=400',
      follower_count: 3400,
      following_count: 800,
      post_count: 89,
      created_at: '2023-03-10T10:00:00Z'
    }
  ],

  // Sponsors
  sponsors: [
    {
      id: 1,
      brand_name: 'TechCorp Solutions',
      bio: 'Leading technology solutions provider. Supporting innovation and growth in the tech community.',
      category: 'Technology',
      email: 'partnerships@techcorp.com',
      phone: '9876543213',
      requirements: 'Tech events, hackathons, developer meetups',
      interests: ['Technology', 'Innovation', 'Education'],
      cities: ['Mumbai', 'Bangalore', 'Delhi'],
      username: 'techcorp_solutions',
      logo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      follower_count: 1200,
      following_count: 450,
      post_count: 67,
      created_at: '2023-02-01T10:00:00Z'
    },
    {
      id: 2,
      brand_name: 'FinanceFirst',
      bio: 'Empowering financial literacy and fintech innovation. Supporting financial education initiatives.',
      category: 'Finance',
      email: 'sponsorships@financefirst.com',
      phone: '9876543214',
      requirements: 'Financial literacy events, fintech meetups',
      interests: ['Finance', 'Education', 'Fintech'],
      cities: ['Mumbai', 'Bangalore', 'Chennai'],
      username: 'finance_first',
      logo_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
      follower_count: 2100,
      following_count: 890,
      post_count: 123,
      created_at: '2022-11-15T10:00:00Z'
    }
  ],

  // Venues
  venues: [
    {
      id: 1,
      name: 'Mumbai Convention Center',
      address: '123 Business District, Mumbai',
      city: 'Mumbai',
      contact_name: 'Rajesh Kumar',
      contact_email: 'bookings@mumbaicc.com',
      contact_phone: '9876543215',
      capacity_min: 50,
      capacity_max: 500,
      price_per_head: 2500,
      hourly_price: 15000,
      daily_price: 100000,
      conditions: 'Catering available, parking for 200 cars, AV equipment included',
      username: 'mumbai_convention',
      follower_count: 800,
      following_count: 200,
      post_count: 34,
      created_at: '2023-01-01T10:00:00Z'
    },
    {
      id: 2,
      name: 'Bangalore Tech Hub',
      address: '456 Innovation Street, Bangalore',
      city: 'Bangalore',
      contact_name: 'Priya Singh',
      contact_email: 'events@bangaloretechhub.com',
      contact_phone: '9876543216',
      capacity_min: 20,
      capacity_max: 200,
      price_per_head: 1800,
      hourly_price: 12000,
      daily_price: 75000,
      conditions: 'High-speed internet, projector, whiteboards, coffee service',
      username: 'bangalore_tech_hub',
      follower_count: 1200,
      following_count: 300,
      post_count: 56,
      created_at: '2022-09-15T10:00:00Z'
    }
  ],

  // Posts
  posts: [
    {
      id: 1,
      author_id: 1,
      author_type: 'member',
      author_name: 'Priya Sharma',
      author_username: 'priya_tech',
      author_photo: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
      caption: 'Just finished an amazing hackathon! The energy and creativity were incredible. Can\'t wait for the next one! 🚀',
      image_urls: [
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400',
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400'
      ],
      tagged_entities: [
        { id: 1, name: 'Tech Mumbai', type: 'community' },
        { id: 1, name: 'TechCorp Solutions', type: 'sponsor' }
      ],
      like_count: 45,
      comment_count: 12,
      created_at: '2024-01-15T14:30:00Z'
    },
    {
      id: 2,
      author_id: 1,
      author_type: 'community',
      author_name: 'Tech Mumbai',
      author_username: 'tech_mumbai',
      author_photo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      caption: 'Join us for our monthly tech meetup! This month we\'re discussing AI and Machine Learning trends. Free entry, snacks provided!',
      image_urls: [
        'https://images.unsplash.com/photo-1515187029135-18ee286d815c?w=400'
      ],
      tagged_entities: [
        { id: 1, name: 'Mumbai Convention Center', type: 'venue' }
      ],
      like_count: 89,
      comment_count: 23,
      created_at: '2024-01-14T10:00:00Z'
    },
    {
      id: 3,
      author_id: 1,
      author_type: 'sponsor',
      author_name: 'TechCorp Solutions',
      author_username: 'techcorp_solutions',
      author_photo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      caption: 'Excited to sponsor the upcoming hackathon! We\'re looking for innovative solutions in fintech. Winners get internship opportunities!',
      image_urls: [
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
        'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400'
      ],
      tagged_entities: [
        { id: 1, name: 'Tech Mumbai', type: 'community' },
        { id: 2, name: 'Startup India', type: 'community' }
      ],
      like_count: 156,
      comment_count: 34,
      created_at: '2024-01-13T16:45:00Z'
    }
  ],

  // Events
  events: [
    {
      id: 1,
      community_id: 1,
      community_name: 'Tech Mumbai',
      title: 'AI & ML Trends Meetup',
      description: 'Join us for an exciting discussion on the latest trends in Artificial Intelligence and Machine Learning.',
      event_date: '2024-02-15T18:00:00Z',
      venue_id: 1,
      venue_name: 'Mumbai Convention Center',
      location: 'Mumbai Convention Center, Mumbai',
      max_attendees: 100,
      current_attendees: 67,
      is_past: false,
      registration_status: 'open',
      created_at: '2024-01-10T10:00:00Z'
    },
    {
      id: 2,
      community_id: 2,
      community_name: 'Startup India',
      title: 'Pitch Perfect Workshop',
      description: 'Learn how to pitch your startup idea effectively to investors and stakeholders.',
      event_date: '2024-01-20T14:00:00Z',
      venue_id: 2,
      venue_name: 'Bangalore Tech Hub',
      location: 'Bangalore Tech Hub, Bangalore',
      max_attendees: 50,
      current_attendees: 50,
      is_past: true,
      registration_status: 'closed',
      created_at: '2024-01-05T10:00:00Z'
    }
  ],

  // Sponsorship Offers
  sponsorshipOffers: [
    {
      id: 1,
      sponsor_id: 1,
      sponsor_name: 'TechCorp Solutions',
      community_id: 1,
      community_name: 'Tech Mumbai',
      event_id: 1,
      event_title: 'AI & ML Trends Meetup',
      amount: 50000,
      status: 'pending',
      message: 'We would love to sponsor your AI meetup. We can provide refreshments and goodie bags for attendees.',
      created_at: '2024-01-12T10:00:00Z'
    },
    {
      id: 2,
      sponsor_id: 2,
      sponsor_name: 'FinanceFirst',
      community_id: 2,
      community_name: 'Startup India',
      event_id: 2,
      event_title: 'Pitch Perfect Workshop',
      amount: 25000,
      status: 'accepted',
      message: 'Happy to support financial literacy initiatives. We can also provide a speaker on fintech trends.',
      created_at: '2024-01-08T10:00:00Z'
    }
  ],

  // Venue Bookings
  venueBookings: [
    {
      id: 1,
      venue_id: 1,
      venue_name: 'Mumbai Convention Center',
      community_id: 1,
      community_name: 'Tech Mumbai',
      event_id: 1,
      event_title: 'AI & ML Trends Meetup',
      booking_date: '2024-02-15T18:00:00Z',
      duration_hours: 3,
      total_cost: 45000,
      status: 'confirmed',
      special_requirements: 'AV equipment, coffee service for 100 people',
      created_at: '2024-01-10T10:00:00Z'
    },
    {
      id: 2,
      venue_id: 2,
      venue_name: 'Bangalore Tech Hub',
      community_id: 2,
      community_name: 'Startup India',
      event_id: 2,
      event_title: 'Pitch Perfect Workshop',
      booking_date: '2024-01-20T14:00:00Z',
      duration_hours: 4,
      total_cost: 30000,
      status: 'completed',
      special_requirements: 'Projector, whiteboards, lunch for 50 people',
      created_at: '2024-01-05T10:00:00Z'
    }
  ],

  // Collaboration Requests
  collaborationRequests: [
    {
      id: 1,
      type: 'received',
      requester_id: 1,
      requester_name: 'TechCorp Solutions',
      requester_type: 'sponsor',
      requester_photo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      recipient_id: 1,
      recipient_name: 'Tech Mumbai',
      recipient_type: 'community',
      message: 'We would love to sponsor your next AI meetup. We can provide refreshments, branded merchandise, and a keynote speaker on AI trends.',
      status: 'pending',
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      type: 'received',
      requester_id: 2,
      requester_name: 'FinanceFirst',
      requester_type: 'sponsor',
      requester_photo_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
      recipient_id: 1,
      recipient_name: 'Tech Mumbai',
      recipient_type: 'community',
      message: 'Interested in collaborating on financial literacy workshops for your community members.',
      status: 'accepted',
      created_at: '2024-01-10T10:00:00Z'
    },
    {
      id: 3,
      type: 'sent',
      requester_id: 1,
      requester_name: 'Tech Mumbai',
      requester_type: 'community',
      requester_photo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      recipient_id: 2,
      recipient_name: 'Startup India',
      recipient_type: 'community',
      recipient_photo_url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400',
      message: 'Would you like to co-host a startup networking event next month?',
      status: 'pending',
      created_at: '2024-01-12T10:00:00Z'
    },
    {
      id: 4,
      type: 'sent',
      requester_id: 1,
      requester_name: 'Tech Mumbai',
      requester_type: 'community',
      requester_photo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400',
      recipient_id: 3,
      recipient_name: 'Design Delhi',
      recipient_type: 'community',
      recipient_photo_url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=400',
      message: 'Looking for a collaboration on a tech-design fusion event. Interested?',
      status: 'accepted',
      created_at: '2024-01-08T10:00:00Z'
    }
  ]
};

export default mockData;
