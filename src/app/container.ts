/**
 * Composition root: el único lugar donde se eligen las implementaciones.
 * Para migrar a una API propia basta con cambiar las clases de aquí
 * (p. ej. SupabaseWishlistRepository → HttpWishlistRepository).
 */
import { AnnouncementService } from '@/modules/announcements/application/AnnouncementService';
import { SupabaseAnnouncementRepository } from '@/modules/announcements/infrastructure/SupabaseAnnouncementRepository';
import { ScheduleService } from '@/modules/schedule/application/ScheduleService';
import { SupabaseScheduleRepository } from '@/modules/schedule/infrastructure/SupabaseScheduleRepository';
import { ChecklistService } from '@/modules/checklist/application/ChecklistService';
import { SupabaseChecklistRepository } from '@/modules/checklist/infrastructure/SupabaseChecklistRepository';
import { EventService } from '@/modules/events/application/EventService';
import { SupabaseEventRepository } from '@/modules/events/infrastructure/SupabaseEventRepository';
import { FamilyService } from '@/modules/families/application/FamilyService';
import { FamilyAccessService } from '@/modules/family-access/application/FamilyAccessService';
import { SupabaseFamilyAccessRepository } from '@/modules/family-access/infrastructure/SupabaseFamilyAccessRepository';
import { SupabaseFamilyRepository } from '@/modules/families/infrastructure/SupabaseFamilyRepository';
import { GameService } from '@/modules/games/application/GameService';
import { SupabaseGameRepository } from '@/modules/games/infrastructure/SupabaseGameRepository';
import { MemberService } from '@/modules/members/application/MemberService';
import { EdgeFunctionMemberAccountService } from '@/modules/members/infrastructure/EdgeFunctionMemberAccountService';
import { SupabaseParticipantRepository } from '@/modules/members/infrastructure/SupabaseParticipantRepository';
import { ResponsibilityService } from '@/modules/responsibilities/application/ResponsibilityService';
import { SupabaseResponsibilityRepository } from '@/modules/responsibilities/infrastructure/SupabaseResponsibilityRepository';
import { SecretFriendService } from '@/modules/secret-friend/application/SecretFriendService';
import { SupabaseSecretFriendRepository } from '@/modules/secret-friend/infrastructure/SupabaseSecretFriendRepository';
import { WishlistService } from '@/modules/wishlist/application/WishlistService';
import { SupabaseWishlistRepository } from '@/modules/wishlist/infrastructure/SupabaseWishlistRepository';
import type { IAuthService } from '@/shared/application/ports/IAuthService';
import { env } from '@/shared/config/env';
import { SupabaseAuthService } from '@/shared/infrastructure/auth/SupabaseAuthService';
import { getSupabaseClient } from '@/shared/infrastructure/supabase/client';

export interface Container {
  auth: IAuthService;
  events: EventService;
  families: FamilyService;
  familyAccess: FamilyAccessService;
  members: MemberService;
  wishlist: WishlistService;
  checklist: ChecklistService;
  responsibilities: ResponsibilityService;
  games: GameService;
  secretFriend: SecretFriendService;
  schedule: ScheduleService;
  announcements: AnnouncementService;
}

export function createContainer(): Container {
  const supabase = getSupabaseClient();
  return {
    auth: new SupabaseAuthService(supabase, env.memberEmailDomain),
    events: new EventService(new SupabaseEventRepository(supabase)),
    families: new FamilyService(new SupabaseFamilyRepository(supabase)),
    familyAccess: new FamilyAccessService(new SupabaseFamilyAccessRepository(supabase)),
    members: new MemberService(new SupabaseParticipantRepository(supabase), new EdgeFunctionMemberAccountService(supabase)),
    wishlist: new WishlistService(new SupabaseWishlistRepository(supabase)),
    checklist: new ChecklistService(new SupabaseChecklistRepository(supabase)),
    responsibilities: new ResponsibilityService(new SupabaseResponsibilityRepository(supabase)),
    games: new GameService(new SupabaseGameRepository(supabase)),
    secretFriend: new SecretFriendService(new SupabaseSecretFriendRepository(supabase)),
    schedule: new ScheduleService(new SupabaseScheduleRepository(supabase)),
    announcements: new AnnouncementService(new SupabaseAnnouncementRepository(supabase)),
  };
}
