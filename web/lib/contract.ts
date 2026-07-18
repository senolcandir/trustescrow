// Deploy edilen ArcEscrow kontrat adresi. .env.local icinde NEXT_PUBLIC_ARC_ESCROW_ADDRESS
// tanimliysa onu kullanir, yoksa buradaki varsayilana (senin deploy ettigin adres) duser.
export const ARC_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ARC_ESCROW_ADDRESS ||
  "0xa17B21d1117722938694ac11201628c8EC2BAe58") as `0x${string}`;
