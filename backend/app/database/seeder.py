# from sqlalchemy.orm import Session
# from ..models.master import Jabatan, Gaji, Kontrak, Bonus, Mobil
# from ..models.karyawan import Karyawan
# from ..utils.security import get_password_hash
# from datetime import date

# def seed_database(db: Session):
#     try:
#         # 1. First seed Gaji
#         gaji_data = [
#             {"jumlah_gaji": 15000000},  # Owner
#             {"jumlah_gaji": 5000000},   # Sales
#             {"jumlah_gaji": 7000000},   # HRD
#             {"jumlah_gaji": 9000000}    # Finance
#         ]
        
#         for data in gaji_data:
#             if not db.query(Gaji).filter_by(jumlah_gaji=data["jumlah_gaji"]).first():
#                 db.add(Gaji(**data))
#         db.commit()
#         print("Gaji seeded successfully")

#         # 2. Seed Jabatan
#         jabatan_data = [
#             {"nama_jabatan": "Owner"},
#             {"nama_jabatan": "Sales"},
#             {"nama_jabatan": "HRD"},
#             {"nama_jabatan": "Finance"}
#         ]
        
#         for data in jabatan_data:
#             if not db.query(Jabatan).filter_by(nama_jabatan=data["nama_jabatan"]).first():
#                 db.add(Jabatan(**data))
#         db.commit()
#         print("Jabatan seeded successfully")

#         # Get references
#         owner_jabatan = db.query(Jabatan).filter_by(nama_jabatan="Owner").first()
#         sales_jabatan = db.query(Jabatan).filter_by(nama_jabatan="Sales").first()
#         owner_gaji = db.query(Gaji).filter_by(jumlah_gaji=15000000).first()
#         sales_gaji = db.query(Gaji).filter_by(jumlah_gaji=5000000).first()

#         # 3. Seed Karyawan
#         karyawan_data = [
#             {
#                 "nama_karyawan": "Idham",
#                 "kd_jabatan": owner_jabatan.kd_jabatan,
#                 "kd_gaji": owner_gaji.kd_gaji,
#                 "jumlah_gaji": owner_gaji.jumlah_gaji,
#                 "username_karyawan": "idham",
#                 "password": "1234"
#             },
#         ]

#         for data in karyawan_data:
#             if not db.query(Karyawan).filter_by(username_karyawan=data["username_karyawan"]).first():
#                 karyawan = Karyawan(
#                     nama_karyawan=data["nama_karyawan"],
#                     kd_jabatan=data["kd_jabatan"],
#                     kd_gaji=data["kd_gaji"],
#                     jumlah_gaji=data["jumlah_gaji"],
#                     username_karyawan=data["username_karyawan"],
#                     hashed_password=get_password_hash(data["password"])
#                 )
#                 db.add(karyawan)
#         db.commit()
#         print("Karyawan seeded successfully")

#         # 4. Seed Bonus
#         bonus_data = [
#             {"kelas_mobil": "Economy", "jumlah_bonus": 1000000},
#             {"kelas_mobil": "Medium", "jumlah_bonus": 2000000},
#             {"kelas_mobil": "Luxury", "jumlah_bonus": 5000000}
#         ]
        
#         for data in bonus_data:
#             if not db.query(Bonus).filter_by(kelas_mobil=data["kelas_mobil"]).first():
#                 db.add(Bonus(**data))
#         db.commit()
#         print("Bonus seeded successfully")

#         # Get bonus references
#         eco_bonus = db.query(Bonus).filter_by(kelas_mobil="Economy").first()
#         med_bonus = db.query(Bonus).filter_by(kelas_mobil="Medium").first()
#         lux_bonus = db.query(Bonus).filter_by(kelas_mobil="Luxury").first()

#         # 5. Seed Mobil
#         mobil_data = [
#             {
#                 "nama_mobil": "Toyota Avanza",
#                 "kelas_mobil": "Economy",
#                 "harga_mobil": 200000000,
#                 "kd_bonus": eco_bonus.kd_bonus
#             },
#             {
#                 "nama_mobil": "Honda CR-V",
#                 "kelas_mobil": "Medium",
#                 "harga_mobil": 500000000,
#                 "kd_bonus": med_bonus.kd_bonus
#             },
#             {
#                 "nama_mobil": "BMW X5",
#                 "kelas_mobil": "Luxury",
#                 "harga_mobil": 1500000000,
#                 "kd_bonus": lux_bonus.kd_bonus
#             }
#         ]

#         for data in mobil_data:
#             if not db.query(Mobil).filter_by(nama_mobil=data["nama_mobil"]).first():
#                 db.add(Mobil(**data))
#         db.commit()
#         print("Mobil seeded successfully")

#     except Exception as e:
#         db.rollback()
#         print(f"Error seeding database: {str(e)}")
#         raise