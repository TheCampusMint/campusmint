import {notFound} from 'next/navigation';
import Preview from './preview';
export const dynamic = 'force-dynamic';
export default function DevelopmentPreview() {
  if(process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES !== 'true')notFound();
  return <Preview/>;
}
